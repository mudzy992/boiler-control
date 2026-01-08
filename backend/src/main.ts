import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://boiler-control.hopto.org',
      'http://localhost:3021', // Vite default
      'http://127.0.0.1:3021',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false, // JWT ide u headeru, ne cookies-e
  });

  app.enableShutdownHooks();
  const port = process.env.APP_PORT!;
  await app.listen(port);
  console.log(
    `Server time: ${new Date().toString()}`,
    'Server sluša na portu:',
    port,
  );
}

bootstrap();
