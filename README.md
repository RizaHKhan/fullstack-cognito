# Fullstack Cognito

Develop infrustructure for a Vue3 App that uses cognito for authentication.

1. **SSL Certificate**

    - Obtain an SSL certificate from AWS Certificate Manager (ACM).

2. **Hosted Zone**

    - Create a hosted zone in Amazon Route 53 for your domain.

3. **S3 Bucket**

    - Create an S3 bucket to host your Vue3 app.
    - Enable static website hosting on the S3 bucket.
    - Upload your Vue3 app build files to the S3 bucket.

4. **CloudFront Distribution**

    - Create a CloudFront distribution to serve your S3 content securely.
    - Configure the distribution to use the SSL certificate from ACM.

5. **Route 53 Configuration**

    - Create an alias record in Route 53 to point your domain to the CloudFront distribution.

6. **AWS Cognito Setup**

    - Create a Cognito User Pool for user management.
    - Create a Cognito Identity Pool to allow users to authenticate.
    - Configure the Vue3 app to use Cognito for authentication.

7. **Build and Deploy Vue3 App**

    - Build your Vue3 app using `npm run build`.
    - Deploy the build files to the S3 bucket.

8. **Codepipeline**
    - Verify that your domain is serving the Vue3 app over HTTPS.
    - Test the app to ensure authentication and other functionalities are working correctly.
