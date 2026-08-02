import Joi from 'joi';
import { commonSchemas } from '../middleware/validate.js';

export const registerSchema = Joi.object({
  body: Joi.object({
    email: commonSchemas.email.required(),
    password: commonSchemas.password.required(),
    firstName: Joi.string().trim().max(50).allow('', null),
    lastName: Joi.string().trim().max(50).allow('', null),
  }),
  query: Joi.object(),
  params: Joi.object(),
});

export const loginSchema = Joi.object({
  body: Joi.object({
    email: commonSchemas.email.required(),
    password: Joi.string().required(),
  }),
  query: Joi.object(),
  params: Joi.object(),
});

export const forgotPasswordSchema = Joi.object({
  body: Joi.object({ email: commonSchemas.email.required() }),
  query: Joi.object(),
  params: Joi.object(),
});

export const resetPasswordSchema = Joi.object({
  body: Joi.object({
    token: Joi.string().required(),
    password: commonSchemas.password.required(),
  }),
  query: Joi.object(),
  params: Joi.object(),
});

export const verifyEmailSchema = Joi.object({
  body: Joi.object({ token: Joi.string().required() }),
  query: Joi.object(),
  params: Joi.object(),
});
