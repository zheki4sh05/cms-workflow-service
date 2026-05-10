import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppModule } from './app/app.module';
import { getRequiredEnv, getRequiredNumberEnv, loadEnvFile } from './app/env';

loadEnvFile();

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CMS Workflow Service API')
    .setDescription('API documentation for CMS Workflow Service')
    .setVersion('1.0')
    .build();
  try {
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);
  } catch (error) {
    logger.error(
      'Swagger OpenAPI document could not be built; HTTP API will still run',
      error instanceof Error ? error.stack : String(error),
    );
  }

  const http = app.getHttpAdapter().getInstance() as {
    get: (path: string, handler: (req: Request, res: Response) => void) => void;
  };
  http.get('/docs', (_req: Request, res: Response) => {
    res.redirect(302, '/api/docs');
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: getRequiredEnv('KAFKA_CLIENT_ID'),
        brokers: getRequiredEnv('KAFKA_BROKERS')
          .split(',')
          .map((value) => value.trim()),
      },
      consumer: {
        groupId: 'cms-workflow-service-consumer-group',
      },
      subscribe: {
        fromBeginning: false,
      },
    },
  });

  const port = getRequiredNumberEnv('PORT');
  await app.listen(port);
  logger.log(`HTTP listening on port ${port}; Swagger UI at /api/docs (redirect from /docs)`);

  try {
    await app.startAllMicroservices();
    logger.log('Kafka microservice started');
  } catch (error) {
    logger.error(
      'Kafka microservice failed to start; REST API remains available',
      error instanceof Error ? error.stack : String(error),
    );
  }
}

bootstrap().catch((error) => {
  logger.error(
    'Application failed to bootstrap',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
