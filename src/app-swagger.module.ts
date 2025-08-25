import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';

// Controllers sem dependências de banco
import { ImportsController } from './imports/imports.controller';
import { MockHealthController } from './health/health.controller.mock';

// Services mock para o Swagger
import { MockImportsService } from './imports/imports.service.mock';
import { ImportsService } from './imports/imports.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.swagger',
    }),
    AuthModule,
  ],
  controllers: [ImportsController, MockHealthController],
  providers: [
    {
      provide: ImportsService,
      useClass: MockImportsService,
    },
  ],
})
export class AppSwaggerModule {}
