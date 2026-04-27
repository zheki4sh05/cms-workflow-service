import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { getRequiredEnv, loadEnvFile } from './app/env';

loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
