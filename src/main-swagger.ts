import { NestFactory } from '@nestjs/core';
import { AppSwaggerModule } from './app-swagger.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppSwaggerModule);
  
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  app.setGlobalPrefix('v1');
  app.enableCors();

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
    .addServer('http://localhost:8080', 'Servidor da API')
    .setContact(
      'Suporte Técnico',
      'https://github.com/diogenesmendes01/api-boletos-getway',
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
  });

  const port = 8080;
  await app.listen(port);
  
  console.log(`🚀 Swagger Demo running on port ${port}`);
  console.log(`📖 Swagger documentation available at: http://localhost:${port}/docs`);
  console.log(`⚠️  Demo mode - database connections disabled`);
}
bootstrap();