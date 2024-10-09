import { SecretValue, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackExtender } from "../extenders/StackExtender";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
    GitHubSourceAction,
    CodeBuildAction,
    S3DeployAction,
    LambdaInvokeAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import {
    CompositePrincipal,
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import {
    Cache,
    BuildSpec,
    LinuxBuildImage,
    LocalCacheMode,
    PipelineProject,
} from "aws-cdk-lib/aws-codebuild";
import { Function } from "aws-cdk-lib/aws-lambda";

export class CicdStack extends StackExtender {
    constructor(scope: Construct, props?: StackProps) {
        super(scope, "AuthenticatorPipeline", props);
    }

    public createPipeline({
        artifactBucket,
        bucket,
        lambda,
    }: {
        artifactBucket: Bucket;
        bucket: Bucket;
        lambda: Function;
    }): void {
        const githubSourceArtifact = new Artifact("githubSourceArtifact");
        const codeBuildArtifact = new Artifact("codeBuildArtifact");
        const oauthToken = SecretValue.secretsManager("github-token");

        const role = new Role(this, "PipelineRole", {
            assumedBy: new CompositePrincipal(
                new ServicePrincipal("codebuild.amazonaws.com"),
                new ServicePrincipal("codepipeline.amazonaws.com"),
            ),
            inlinePolicies: {
                CdkDeployPermissions: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            actions: ["sts:AssumeRole"],
                            resources: ["arn:aws:iam::*:role/cdk-*"],
                        }),
                    ],
                }),
            },
        });

        new Pipeline(this, "CIPipeline", {
            pipelineName: "fullstack-cognito-pipeline",
            role,
            artifactBucket,
            stages: [
                {
                    stageName: "Source",
                    actions: [
                        new GitHubSourceAction({
                            actionName: "GitHubSource",
                            owner: "RizaHKhan",
                            repo: "fullstack-cognito-frontend",
                            branch: "master",
                            oauthToken,
                            output: githubSourceArtifact,
                        }),
                    ],
                },
                {
                    stageName: "Build",
                    actions: [
                        new CodeBuildAction({
                            actionName: "CodeBuild",
                            project: new PipelineProject( // We build a temporary environment here to build the project, which makes sense because it requires nodejs
                                this,
                                "CodeBuildProject",
                                {
                                    environment: {
                                        buildImage:
                                            LinuxBuildImage.AMAZON_LINUX_2_5,
                                    },
                                    buildSpec: BuildSpec.fromObject({
                                        version: "0.2",
                                        phases: {
                                            install: {
                                                // in this phase, we install the dependencies that the project needs
                                                "runtime-versions": {
                                                    nodejs: "20.x",
                                                },
                                                commands: ["npm install"], // Installs all the stuff in package.json
                                            },
                                            build: {
                                                commands: ["npm run build"],
                                            },
                                        },
                                        artifacts: {
                                            "base-directory": "dist", // Everything gets build into the dist folder
                                            files: ["**/*"], // We want everything in the dist folder
                                        },
                                    }),
                                    cache: Cache.local(LocalCacheMode.CUSTOM),
                                },
                            ),
                            input: githubSourceArtifact,
                            outputs: [codeBuildArtifact],
                        }),
                    ],
                },
                {
                    stageName: "Deploy",
                    actions: [
                        new S3DeployAction({
                            actionName: "DeployFrontend",
                            bucket,
                            input: codeBuildArtifact,
                            extract: true,
                        }),
                    ],
                },
                {
                    stageName: "InvalidateCache",
                    actions: [
                        new LambdaInvokeAction({
                            actionName: "InvalidateCloudfrontCache",
                            lambda,
                        }),
                    ],
                },
            ],
        });
    }
}
