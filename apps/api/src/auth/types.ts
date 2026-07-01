export interface JwtPayload {
  sub: string;
  username: string;
}

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}
