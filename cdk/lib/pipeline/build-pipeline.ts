// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Duration } from 'aws-cdk-lib';
import {AnyPrincipal, Effect, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import {BlockPublicAccess, BucketEncryption} from 'aws-cdk-lib/aws-s3';
import {EcsCanaryService} from '..';
import {ICluster} from 'aws-cdk-lib/aws-ecs';
import {IVpc} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import iam = require('aws-cdk-lib/aws-iam');
import s3 = require('aws-cdk-lib/aws-s3');
import ecr = require('aws-cdk-lib/aws-ecr');
import codeCommit = require('aws-cdk-lib/aws-codecommit');
import codeBuild = require('aws-cdk-lib/aws-codebuild');
import codePipeline = require('aws-cdk-lib/aws-codepipeline');
import codePipelineActions = require('aws-cdk-lib/aws-codepipeline-actions');


export interface EcsCanaryPipelineProps {
    readonly codeRepoName?: string;
    readonly ecrRepoName?: string;
    readonly codeBuildProjectName?: string;
    readonly ecsTaskRoleArn?: string;
    readonly apiName?: string;
    readonly vpc?: IVpc;
    readonly cluster?: ICluster;
}

export class EcsCanaryPipeline extends Construct {

    constructor(scope: Construct, id: string, props: EcsCanaryPipelineProps = {}) {
        super(scope, id);

        const codeRepo = codeCommit.Repository.fromRepositoryName(this, 'codeRepo', props.codeRepoName!);
        const ecrRepo = ecr.Repository.fromRepositoryName(this, 'ecrRepo', props.ecrRepoName!);
        const codeBuildProject = codeBuild.Project.fromProjectName(this, 'codeBuild', props.codeBuildProjectName!);
        const ecsTaskRole = iam.Role.fromRoleArn(this, 'ecsTaskRole', props.ecsTaskRoleArn!);

        const codePipelineRole = new iam.Role(this, 'codePipelineRole', {
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com')
        });

        const codePipelinePolicy = new iam.PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                'iam:PassRole',
                'sts:AssumeRole',
                'codecommit:Get*',
                'codecommit:List*',
                'codecommit:GitPull',
                'codecommit:UploadArchive',
                'codecommit:CancelUploadArchive',
                'codebuild:BatchGetBuilds',
                'codebuild:StartBuild',
                'codedeploy:CreateDeployment',
                'codedeploy:Get*',
                'codedeploy:RegisterApplicationRevision',
                's3:Get*',
                's3:List*',
                's3:PutObject'
            ],
            resources: ['*']
        });

        codePipelineRole.addToPolicy(codePipelinePolicy);

        const sourceArtifact = new codePipeline.Artifact('sourceArtifact');
        const buildArtifact = new codePipeline.Artifact('buildArtifact');

        // S3 bucket for storing the code pipeline artifacts
        const artifactsBucket = new s3.Bucket(this, 'artifactsBucket', {
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL
        });

        // S3 bucket policy for the code pipeline artifacts
        const denyUnEncryptedObjectUploads = new iam.PolicyStatement({
            effect: Effect.DENY,
            actions: ['s3:PutObject'],
            principals: [new AnyPrincipal()],
            resources: [artifactsBucket.bucketArn.concat('/*')],
            conditions: {
                StringNotEquals: {
                    's3:x-amz-server-side-encryption': 'aws:kms'
                }
            }
        });

        const denyInsecureConnections = new iam.PolicyStatement({
            effect: Effect.DENY,
            actions: ['s3:*'],
            principals: [new AnyPrincipal()],
            resources: [artifactsBucket.bucketArn.concat('/*')],
            conditions: {
                Bool: {
                    'aws:SecureTransport': 'false'
                }
            }
        });

        artifactsBucket.addToResourcePolicy(denyUnEncryptedObjectUploads);
        artifactsBucket.addToResourcePolicy(denyInsecureConnections);

        const ecsCanaryService = new EcsCanaryService(this, 'service', {
            apiName: props.apiName,
            ecrRepository: ecrRepo,
            ecsTaskRole: ecsTaskRole,
            vpc: props.vpc,
            cluster: props.cluster,
            taskCount: 3,
            canaryPercentage: 10
        });

        // Code Pipeline - CloudWatch trigger event is created by CDK
        const pipeline = new codePipeline.Pipeline(this, 'ecsCanary', {
            role: codePipelineRole,
            artifactBucket: artifactsBucket,
            stages: [
                {
                    stageName: 'Source',
                    actions: [
                        new codePipelineActions.CodeCommitSourceAction({
                            actionName: 'Source',
                            repository: codeRepo,
                            output: sourceArtifact,
                            branch: 'main'
                        }),
                    ]
                },
                {
                    stageName: 'Build',
                    actions: [
                        new codePipelineActions.CodeBuildAction({
                            actionName: 'Build',
                            project: codeBuildProject,
                            input: sourceArtifact,
                            outputs: [buildArtifact]
                        })
                    ]
                },
                {
                    stageName: 'CanaryDeploy',
                    actions: [
                        new codePipelineActions.EcsDeployAction({
                            actionName: 'CanaryDeploy',
                            service: ecsCanaryService.ecsCanaryService,
                            deploymentTimeout: Duration.minutes(10),
                            input: buildArtifact
                        })
                    ]
                },
                {
                    stageName: 'ManualApproval',
                    actions: [
                        new codePipelineActions.ManualApprovalAction({
                            actionName: 'ApproveRelease'
                        })
                    ]
                },
                {
                    stageName: 'Deploy',
                    actions: [
                        new codePipelineActions.EcsDeployAction({
                            actionName: 'Deploy',
                            service: ecsCanaryService.ecsService,
                            deploymentTimeout: Duration.minutes(15),
                            input: buildArtifact
                        })
                    ]
                }
            ]
        });
    }

}