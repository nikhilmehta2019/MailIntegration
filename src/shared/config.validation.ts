import * as Joi from 'joi';
import 'joi-extract-type';

const validator = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test'),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),

  BASE_FOLDER_PATH: Joi.string().required(),
  FILE_NAME_LENGTH: Joi.number().required(),
  RANDOM_FOLDER_LENGTH: Joi.number().required(),
});
export default validator;
