import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  app.setGlobalPrefix('v1');
  
  // Configuração do CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS', '');
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',') : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  });

  // Configuração do Swagger
  const config = new DocumentBuilder()
    .setTitle('API Boletos Gateway')
    .setDescription('API assíncrona para importação em massa e geração de boletos via OlympiaBank')
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
    .addServer(configService.get('API_BASE_URL', 'http://localhost:8080'), 'Servidor da API')
    .setContact(
      'Suporte Técnico',
      'https://github.com/seu-usuario/api-boletos-gateway',
      'suporte@exemplo.com'
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

  const port = configService.get<number>('API_PORT', 8080);
  await app.listen(port);
  
  console.log(`API running on port ${port}`);
  console.log(`📖 Swagger documentation available at: http://localhost:${port}/docs`);
}
bootstrap();