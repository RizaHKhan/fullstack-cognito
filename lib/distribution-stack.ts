import { StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackExtender } from "../extenders/StackExtender";
import {
    Certificate,
    CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { S3StaticWebsiteOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
    CachePolicy,
    Distribution,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

export class DistributionStack extends StackExtender {
    public hostedZone: HostedZone;
    public certificate: Certificate;
    public invalidationLambda: Function;

    constructor(scope: Construct, props?: StackProps) {
        super(scope, "AuthenticatorAcm", props);

        this.createHostedZone();
        this.createCertificate();
    }

    private createHostedZone(): void {
        this.hostedZone = new HostedZone(
            this,
            this.setConstructName("HostedZone"),
            {
                zoneName: this.domainName,
            },
        );
    }

    private createCertificate(): void {
        this.certificate = new Certificate(
            this,
            this.setConstructName("Certificate"),
            {
                domainName: this.domainName, // Root domain (modernartisans.xyz)
                subjectAlternativeNames: [`*.${this.domainName}`], // Wildcard domain (*.modernartisans.xyz)
                validation: CertificateValidation.fromDns(this.hostedZone),
            },
        );
    }

    public createCloudfrontDistributionAndARecord(bucket: Bucket): void {
        const distribution = new Distribution(
            this,
            this.setConstructName("Distribution"),
            {
                defaultRootObject: "index.html",
                defaultBehavior: {
                    origin: new S3StaticWebsiteOrigin(bucket),
                    viewerProtocolPolicy:
                        ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: CachePolicy.CACHING_OPTIMIZED,
                },
                domainNames: [`www.${this.domainName}`, this.domainName],
                certificate: this.certificate,
            },
        );

        this.invalidationLambda = new Function(
            this,
            "InvalidateCloudfrontCache",
            {
                runtime: Runtime.PYTHON_3_9,
                code: Code.fromAsset("lambda"),
                handler: "invalidate.handler",
                environment: {
                    DISTRIBUTION_ID: distribution.distributionId,
                },
            },
        );

        this.invalidationLambda.addToRolePolicy(
            new PolicyStatement({
                actions: [
                    "codepipeline:PutJobSuccessResult",
                    "codepipeline:PutJobFailureResult",
                ],
                resources: ["*"], // You can scope this down to the specific pipeline ARN
            }),
        );

        if (this.invalidationLambda.role) {
            distribution.grantCreateInvalidation(this.invalidationLambda.role);
        }

        // A Record for www
        new ARecord(this, "ARecord", {
            zone: this.hostedZone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
            recordName: `www.${this.domainName}`,
        });

        // A Record for root domain
        new ARecord(this, "RootARecord", {
            zone: this.hostedZone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
            recordName: this.domainName, // root domain
        });
    }
}
