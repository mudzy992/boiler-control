import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { authCookieEnabled } from './modules/Auth/auth-cookie';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());

  // CORS
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    throw new Error('FRONTEND_URL environment variable is required');
  }

  app.enableCors({
    origin: frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // SEC-4: `credentials` je potrebno da browser pošalje httpOnly refresh
    // cookie na /api/auth/refresh. Uslovljeno je zastavicom kako bi rollback
    // bio čist — dok je `off`, CORS je doslovno kao prije ove promjene.
    // Sigurno je i kad je `on` jer `origin` je fiksna vrijednost, ne refleksija
    // (potvrđeno u scripts/audit/cors_headers_repro.cjs).
    credentials: authCookieEnabled(),
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Boiler Control API')
    .setDescription('The Boiler Control API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = Number(process.env.APP_PORT || 3000);

  await app.listen(port);

  console.log(
    `Server time: ${new Date().toString()}`,
    'Server listening on port:',
    port,
    'Swagger at: /api/docs',
  );
}

bootstrap();
