import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggerService } from './common/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const loggerService = app.get(LoggerService);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Configuração do prefixo global da API
  app.setGlobalPrefix('v1', {
    exclude: ['/health', '/docs', '/swagger'],
  });

  // Configuração do CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS', '');
  const isDevelopment = process.env.NODE_ENV === 'development';

  app.enableCors({
    origin: isDevelopment ? true : corsOrigins ? corsOrigins.split(',') : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Api-Key',
      'X-Requested-With',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Configuração do Swagger
  const apiBaseUrl = configService.get('API_BASE_URL');
  const isProduction = process.env.NODE_ENV === 'production';

  // Determinar a URL base para o Swagger
  let swaggerBaseUrl = 'http://localhost:3000';
  if (isProduction && apiBaseUrl) {
    swaggerBaseUrl = apiBaseUrl;
  } else if (apiBaseUrl) {
    swaggerBaseUrl = apiBaseUrl;
  }

  const config = new DocumentBuilder()
    .setTitle('API Boletos Gateway')
    .setDescription(
      'API assíncrona para importação em massa e geração de boletos via OlympiaBank',
    )
    .setVersion('1.0.0')
    .addTag('imports', 'Endpoints para importação de arquivos CSV/XLSX')
    .addTag('health', 'Health checks e monitoramento')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        name: 'Authorization',
        description: 'Digite seu Bearer token para autenticação',
        in: 'header',
      },
      'bearer-key',
    )
    .addServer(
      swaggerBaseUrl,
      isProduction ? 'Servidor de Produção' : 'Servidor Local',
    )
    .setContact(
      'Suporte Técnico',
      'https://github.com/diogenesmendes01/api-boletos-getway',
      'suporte@exemplo.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'API Boletos Gateway - Documentação',
    customfavIcon: '/favicon.ico',
    customCssUrl: '/swagger-ui.css',
  });

  const port = configService.get<number>('PORT', 3000);

  loggerService.info('Starting API server', {
    port,
    nodeEnv: process.env.NODE_ENV,
    type: 'server_startup',
  });

  await app.listen(port);

  loggerService.info('API server started successfully', {
    port,
    swaggerDocs: `http://localhost:${port}/docs`,
    type: 'server_ready',
  });

  // console.log(`API running on port ${port}`);
  // console.log(
  //   `📖 Swagger documentation available at: http://localhost:${port}/docs`,
  // );
}

bootstrap().catch(_error => {
  // console.error('Failed to start application:', error);
  process.exit(1);
});
