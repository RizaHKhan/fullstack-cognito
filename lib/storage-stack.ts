import { RemovalPolicy, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackExtender } from "../extenders/StackExtender";
import { OriginAccessIdentity } from "aws-cdk-lib/aws-cloudfront";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";

export class StorageStack extends StackExtender {
  public cloudfrontBucket: Bucket;
  public sourceBucket: Bucket;

  constructor(scope: Construct, props?: StackProps) {
    super(scope, "AuthenticatorStorage", props);

    this.createDistributionBucket();
    this.createSourceBucket();
  }

  private createDistributionBucket(): void {
    const originAccessIdentity = new OriginAccessIdentity(
      this,
      "OriginAccessIdentity",
    );

    this.cloudfrontBucket = new Bucket(this, `DistributionBucket`, {
      bucketName: `authenticator-frontend-deploy-bucket`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "error.html",
      publicReadAccess: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
    });
    this.cloudfrontBucket.grantRead(originAccessIdentity);
  }

  private createSourceBucket(): void {
    this.sourceBucket = new Bucket(this, "SourceBucket", {
      bucketName: "fullstack-cognito-codepipeline-source-bucket",
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}
