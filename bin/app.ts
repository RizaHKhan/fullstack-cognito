#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { DistributionStack } from "../lib/distribution-stack";
import { env } from "process";
import { StorageStack } from "../lib/storage-stack";
import { CicdStack } from "../lib/cicd-stack";
import { AuthenticationStack } from "../lib/authentication-stack";

const { CDK_DEFAULT_ACCOUNT } = env;

const app = new App({
    context: {
        domainName: "modernartisans.xyz",
        appName: "Authenticator",
        env: { region: "us-east-1", account: CDK_DEFAULT_ACCOUNT },
    },
});

// Creates the Certificate, Hosted Zone on initialization.
// Provides a function which will created the Cloudfront distribution for the bucket we create later on
const distribution = new DistributionStack(app);

// Creates the s3 bucket for distribution purposes right away.
const storage = new StorageStack(app);
// Creates the cloudfront distribution here
distribution.createCloudfrontDistributionAndARecord(storage.cloudfrontBucket);

const cicd = new CicdStack(app);

cicd.createPipeline({
    artifactBucket: storage.sourceBucket,
    bucket: storage.cloudfrontBucket,
    lambda: distribution.invalidationLambda,
});

new AuthenticationStack(app);
