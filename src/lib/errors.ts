export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid input") {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Not authorised") {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}
