import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { UserToken } from '../entities/user-token.entity';

@Module({
  imports: [
    // Configurar JwtModule com ConfigService
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'default_secret_key',
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN') || '24h',
        },
      }),
      inject: [ConfigService],
    }),

    // Registrar a entidade UserToken
    TypeOrmModule.forFeature([UserToken]),
  ],
  providers: [
    AuthGuard,
    AuthService, // ← FALTAVA este provider!
  ],
  exports: [AuthGuard, AuthService],
})
export class AuthModule {}
