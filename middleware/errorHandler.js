/**
 * Middleware de tratamento de erros
 */

// Classe personalizada para erros da aplicação
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Função para wrapping de funções async
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware de tratamento de erros
const errorHandler = (error, req, res, next) => {
  let err = { ...error };
  err.message = error.message;

  // Log do erro
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Erro de validação do Joi
  if (error.name === 'ValidationError') {
    const message = 'Dados inválidos';
    err = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Erro de sintaxe JSON
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    const message = 'Formato JSON inválido';
    err = new AppError(message, 400, 'INVALID_JSON');
  }

  // Erro de autenticação do Supabase
  if (error.message && error.message.includes('JWT')) {
    const message = 'Token de acesso inválido';
    err = new AppError(message, 401, 'INVALID_TOKEN');
  }

  // Erro de banco de dados do Supabase
  if (error.code && error.code.startsWith('PGRST')) {
    let message = 'Erro no banco de dados';
    let statusCode = 500;
    
    switch (error.code) {
      case 'PGRST116':
        message = 'Tabela não encontrada';
        statusCode = 404;
        break;
      case 'PGRST204':
        message = 'Registro não encontrado';
        statusCode = 404;
        break;
      case 'PGRST301':
        message = 'Permissão negada';
        statusCode = 403;
        break;
    }
    
    err = new AppError(message, statusCode, 'DATABASE_ERROR');
  }

  // Rate limiting
  if (error.statusCode === 429) {
    const message = 'Muitas tentativas. Tente novamente mais tarde.';
    err = new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Resposta de erro padronizada
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Erro interno do servidor',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  });
};

// Middleware para rotas não encontradas
const notFound = (req, res, next) => {
  const error = new AppError(`Rota ${req.originalUrl} não encontrada`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFound
};