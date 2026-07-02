import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * class-validator returns `message` as a string array on nested/multiple constraint
 * failures, but the web's error parser only accepts a string and falls back to a
 * generic 'Request failed' otherwise. Flatten everything into one string, joined
 * with '; ', while keeping the standard { statusCode, message, error } shape.
 */
function flattenValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => {
    const ownMessages = error.constraints ? Object.values(error.constraints) : [];
    const childMessages = error.children?.length ? flattenValidationErrors(error.children) : [];
    return [...ownMessages, ...childMessages];
  });
}

async function bootstrap(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required but was not set.');
  }

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(flattenValidationErrors(errors).join('; ')),
    }),
  );
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  await app.listen(process.env.API_PORT ?? 3000);
}

void bootstrap();
