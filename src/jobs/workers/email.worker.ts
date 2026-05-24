import { Worker, Job } from 'bullmq';
import { Resend } from 'resend';
import { redisClient } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const emailWorker = new Worker(
  'email',
  async (job: Job) => {
    const { to, subject, html } = job.data;
    logger.info({ jobId: job.id, to, subject }, 'Processing email job');

    if (!resend) {
      logger.warn({ jobId: job.id, to }, 'Resend API key missing. Mocking email delivery.');
      return;
    }

    try {
      const response = await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
      });

      if (response.error) {
        throw new Error(`Resend API error: ${JSON.stringify(response.error)}`);
      }

      logger.info({ jobId: job.id, emailId: response.data?.id }, 'Email sent successfully');
    } catch (err: any) {
      logger.error({ jobId: job.id, err: err.message }, 'Failed to send email via Resend');
      throw err; // Trigger BullMQ retry strategy
    }
  },
  {
    connection: redisClient,
    concurrency: 5,
  }
);

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Email job failed permanently');
});
