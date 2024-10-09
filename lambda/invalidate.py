import boto3
import os
import time


def handler(event, context):
    # Get DISTRIBUTION_ID from environment variables
    distribution_id = os.environ.get("DISTRIBUTION_ID")

    if not distribution_id:
        raise ValueError("DISTRIBUTION_ID environment variable is not set")

    client = boto3.client("cloudfront")
    codepipeline = boto3.client("codepipeline")

    # Generate unique caller reference based on timestamp
    caller_reference = str(time.time())

    # Specify the paths to invalidate (/* invalidates all files)
    paths = {"Quantity": 1, "Items": ["/*"]}

    # Create invalidation batch request
    invalidation_batch = {"Paths": paths, "CallerReference": caller_reference}

    try:
        # Trigger the invalidation
        response = client.create_invalidation(
            DistributionId=distribution_id, InvalidationBatch=invalidation_batch
        )
        print(f"Invalidation successful: {response}")

        # Notify CodePipeline of success
        job_id = event["CodePipeline.job"]["id"]
        codepipeline.put_job_success_result(jobId=job_id)

    except Exception as e:
        print(f"Error during invalidation: {e}")

        # Notify CodePipeline of failure
        job_id = event["CodePipeline.job"]["id"]
        codepipeline.put_job_failure_result(
            jobId=job_id, failureDetails={
                "message": str(e), "type": "JobFailed"}
        )
        raise e
