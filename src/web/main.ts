import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { getRequiredEnv, loadEnvFile } from './app/env';

loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CMS Workflow Service API')
    .setDescription('API documentation for CMS Workflow Service')
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, swaggerDocument);

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

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 9095);
}
bootstrap();
