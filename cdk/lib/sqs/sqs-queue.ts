// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Duration, CfnOutput } from 'aws-cdk-lib';

import cloudWatch = require('aws-cdk-lib/aws-cloudwatch');
import sqs = require('aws-cdk-lib/aws-sqs');

export class SQSQueue extends Construct {

    public readonly dlq: sqs.Queue;
    public readonly queue: sqs.Queue;
    public readonly cwalarm: cloudWatch.Alarm;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        this.dlq = new sqs.Queue(this, 'AppDLQueue', {
            queueName: 'app-sample-dlq',
            visibilityTimeout: Duration.seconds(300),
            retentionPeriod: Duration.minutes(60)
        })

        this.queue = new sqs.Queue(this, 'AppQueue', {
            queueName: 'app-sample',
            visibilityTimeout: Duration.seconds(300),
            deadLetterQueue: {
                queue: this.dlq,
                maxReceiveCount: 1
            }
        })

        const metric = new cloudWatch.Metric({
            namespace: 'AWS/SQS',
            metricName: 'ApproximateNumberOfMessagesVisible',
            dimensionsMap: {
                QueueName: this.dlq.queueName
            },
            statistic: cloudWatch.Statistic.MAXIMUM,
            period: Duration.seconds(300)
        });

        this.cwalarm = new cloudWatch.Alarm(this, 'AppDLQAlarm', {
            alarmDescription: 'CloudWatch Alarm for the DLQ',
            metric: metric,
            threshold: 10,
            evaluationPeriods: 1
        });



        new CfnOutput(this, 'ecsCanaryDLQName', {
            description: 'Dead Letter Queue Name',
            exportName: 'canaryDLQ',
            value: this.dlq.queueName
        })

        new CfnOutput(this, 'ecsCanaryQueueName', {
            description: 'Queue Name',
            exportName: 'canaryQueue',
            value: this.queue.queueName
        })
    }
}