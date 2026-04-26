import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: process.env.KAFKA_CLIENT_ID ?? 'cms-workflow-service',
        brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
          .split(',')
          .map((value) => value.trim()),
      },
      consumer: {
        groupId:
          process.env.KAFKA_GROUP_ID ?? 'cms-workflow-service-consumer-group',
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
