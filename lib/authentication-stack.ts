import { CfnOutput, SecretValue, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackExtender } from "../extenders/StackExtender";
import {
    AccountRecovery,
    CfnIdentityPool,
    CfnIdentityPoolRoleAttachment,
    UserPool,
    UserPoolClient,
    UserPoolIdentityProviderGoogle,
} from "aws-cdk-lib/aws-cognito";
import { Role, FederatedPrincipal, ManagedPolicy } from "aws-cdk-lib/aws-iam";

export class AuthenticationStack extends StackExtender {
    public userPool: UserPool;
    public googleIdentityPool: CfnIdentityPool;
    public userPoolClient: UserPoolClient;
    public identityPool: CfnIdentityPool;
    private clientId: SecretValue;
    private clientSecret: SecretValue;

    constructor(scope: Construct, props?: StackProps) {
        super(scope, "AuthenticatorAuth", props);

        this.clientId = SecretValue.secretsManager("google-clientId");
        this.clientSecret = SecretValue.secretsManager("google-clientSecret");

        // Create Cognito User Pool
        this.createUserPool();

        // Create Cognito User Pool Client
        this.createUserPoolClient();

        // Create Google Identity Provider
        this.createGoogleIdentityProvider();

        // Create Identity Pool with User Pool and Google Provider
        this.createIdentityPool();

        // Create Roles and attach them to the Identity Pool
        this.createIdentityPoolRoles();

        new CfnOutput(this, "UserPoolId", {
            value: this.userPool.userPoolId,
        });
        new CfnOutput(this, "UserPoolClientId", {
            value: this.userPoolClient.userPoolClientId,
        });
        new CfnOutput(this, "IdentityPoolId", {
            value: this.identityPool.ref, // Identity Pool ID
        });
    }

    private createUserPool() {
        this.userPool = new UserPool(this, "MyUserPool", {
            userPoolName: "EmailPasswordUserPool",
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true,
            },
            selfSignUpEnabled: true,
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            accountRecovery: AccountRecovery.EMAIL_ONLY,
        });
    }

    private createUserPoolClient() {
        this.userPoolClient = new UserPoolClient(this, "UserPoolClient", {
            userPool: this.userPool,
        });
    }

    private createGoogleIdentityProvider() {
        new UserPoolIdentityProviderGoogle(this, "GoogleIdentityProvider", {
            userPool: this.userPool,
            clientId: this.clientId,
            clientSecret: this.clientSecret,
        });
    }

    private createIdentityPool() {
        this.identityPool = new CfnIdentityPool(this, "MyIdentityPool", {
            identityPoolName: "MyIdentityPool",
            allowUnauthenticatedIdentities: false, // You can set this to true if you want to allow unauthenticated users
            cognitoIdentityProviders: [
                {
                    clientId: this.userPoolClient.userPoolClientId, // Use the Cognito User Pool Client ID here
                    providerName: this.userPool.userPoolProviderName, // Use the Cognito User Pool provider name
                },
            ],
            supportedLoginProviders: {
                "accounts.google.com": this.clientId,
            },
        });
    }

    private createIdentityPoolRoles() {
        // Authenticated Role (used by logged-in users)
        const authenticatedRole = new Role(
            this,
            "CognitoDefaultAuthenticatedRole",
            {
                assumedBy: new FederatedPrincipal(
                    "cognito-identity.amazonaws.com",
                    {
                        StringEquals: {
                            "cognito-identity.amazonaws.com:aud":
                                this.identityPool.ref,
                        },
                        "ForAnyValue:StringLike": {
                            "cognito-identity.amazonaws.com:amr":
                                "authenticated",
                        },
                    },
                    "sts:AssumeRoleWithWebIdentity"
                ),
                managedPolicies: [
                    ManagedPolicy.fromAwsManagedPolicyName(
                        "AmazonCognitoPowerUser"
                    ), // You can attach your own policies here
                ],
            }
        );

        // Unauthenticated Role (used by guests or non-logged-in users)
        // const unauthenticatedRole = new Role(
        //     this,
        //     "CognitoDefaultUnauthenticatedRole",
        //     {
        //         assumedBy: new FederatedPrincipal(
        //             "cognito-identity.amazonaws.com",
        //             {
        //                 StringEquals: {
        //                     "cognito-identity.amazonaws.com:aud":
        //                         this.identityPool.ref,
        //                 },
        //                 "ForAnyValue:StringLike": {
        //                     "cognito-identity.amazonaws.com:amr":
        //                         "unauthenticated",
        //                 },
        //             },
        //             "sts:AssumeRoleWithWebIdentity",
        //         ),
        //     },
        // );

        // Attach Roles to the Identity Pool
        new CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
            identityPoolId: this.identityPool.ref,
            roles: {
                authenticated: authenticatedRole.roleArn,
                // unauthenticated: unauthenticatedRole.roleArn,
            },
        });
    }
}
