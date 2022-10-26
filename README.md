# ECS canary deployment using CDK

A walkthrough for this example can be found at **TBD**

#### Table of Contents

* [Outcome](#outcome)
* [What are we building?](#what-are-we-building)
* [Why do I need this?](#why-do-i-need-this)
* [What are the pre-requisites?](#what-are-the-pre-requisites)
* [How can I deploy the stack?](#how-can-i-deploy-the-stack)
* [Cleanup](#cleanup)
* [Security](#security)
* [License](#license)

## Outcome

ECS canary deployment CDK construct enabling teams to build and deploy CI/CD pipeline for their backend/queue processing workloads.

## What are we building?

* Two ECS Services will be deployed in ECS Cluster, one for handling the Canary traffic and the other for live
* CodePipeline will be used for executing Canary deployment using CodeCommit, CodeBuild, ECS Deployment provider and a manual approval stage
* The container images will be stored in the Elastic Container Registry
* SQS Consumer sample application is deployed in AWS Fargate
* After sucessful release, both services will run same version of the code

![canary-pipeline](./canary-pipeline.png)

## Why do I need this?

* With a canary deployment, you provision a new set of containers (Canary Service) on which the latest version of your application is deployed
* canary deployments allow you to test the new application version before sending production traffic to it without disrupting the existing environment
* Once the testing is completed, you can approve the manual stage to update the production tasks
* You can incorporate the principle of infrastructure immutability by provisioning fresh instances when you need to make changes. In this way, you avoid configuration drift
* You can also configure CloudWatch Alarm to monitor the Canary release and automatically  rollback to live version in case of any errors

## What are the pre-requisites?

```
brew install jq
npm install -g -f aws-cdk@2.46.0
cd $HOME && mkdir -p environment && cd environment
git clone https://github.com/ashoksrirama/ecs-canary-pattern.git
cd $HOME/environment/ecs-canary-pattern
```
* You have configured AWS CLI using `aws configure`
* You have the set the `AWS_REGION` within `aws configure`
* The role being used from CLI has the permissions required for resources being created by CDK
* HTTPS (GRC) is the protocol to use with `git-remote-codecommit` (GRC). This utility provides a simple method for pushing and pulling code from CodeCommit repositories by extending Git. It is the recommended method for supporting connections made with federated access, identity providers, and temporary credentials
* Install `git-remote-codecommit` with `pip install git-remote-codecommit`

## How can I deploy the stack?

* Install dependencies and build
    ```shell
    npm install
    npm run build
    npm run test
    ```
* Deploy the CodeCommit and CodeBuild resources
    ```shell
    cd $HOME/environment/ecs-canary-pattern
    ./bin/scripts/deploy-image-stack.sh
    ```
* Push the source code to CodeCommit
  * The source code is available [here](app-sample/README.md)
  * The [buildspec.yml](app-sample/buildspec.yml) has placeholders for the variables
    ```shell
    export AWS_DEFAULT_REGION=$(aws configure get region)
    export CODE_REPO_NAME=app-sample
    export CODE_REPO_URL=codecommit::$AWS_DEFAULT_REGION://$CODE_REPO_NAME
    cd $HOME/environment && git clone $CODE_REPO_URL && cd $CODE_REPO_NAME
    cp $HOME/environment/ecs-canary-pattern/app-sample/* .
    git checkout -b main
    git remote -v
    git add .
    git commit -m "Initial commit"
    git push --set-upstream origin main
    ```
* Deploy the CodePipeline resources
    ```shell
    cd $HOME/environment/ecs-canary-pattern
    ./bin/scripts/deploy-pipeline-stack.sh
    ```

## Cleanup

```shell
cd $HOME/environment/ecs-canary-pattern
./bin/scripts/destroy.sh
```

# Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

# License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.