import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Security (Helmet)
  app.use(helmet());

  // 2. CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3021',
      'http://localhost:5173',
      'https://boiler-control.hopto.org',
      'http://192.168.31.247:8082',
      'http://localhost:8082',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // 3. Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips properties that don't exist in the DTO
      forbidNonWhitelisted: true, // Throws error if non-whitelisted properties are present
      transform: true, // Automatically transforms payloads to be objects typed according to their DTO classes
      transformOptions: {
        enableImplicitConversion: true, // Allows automatic conversion of query params (e.g. "1" -> 1)
      },
    }),
  );

  // 4. Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Boiler Control API')
    .setDescription('The Boiler Control API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();
  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(
    `Server time: ${new Date().toString()}`,
    'Server listening on port:',
    port,
    'Swagger at: /api/docs',
  );
}

bootstrap();
