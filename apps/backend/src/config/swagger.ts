import swaggerJsdoc from 'swagger-jsdoc';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Mavinmail API',
            version,
            description: 'API documentation for Mavinmail Backend',
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
            contact: {
                name: 'Mavinmail Support',
                url: 'https://mavinmail.com',
                email: 'support@mavinmail.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:5002',
                description: 'Local Development Server',
            },
            {
                url: 'https://api.mavinmail.com',
                description: 'Production Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            responses: {
                UnauthorizedError: {
                    description: 'Access token is missing or invalid',
                },
                NotFound: {
                    description: 'Resource not found',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.ts', './src/app.ts', './src/schema/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
