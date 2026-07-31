import { SampleSketch } from '../types';

export const SAMPLE_SKETCHES: SampleSketch[] = [
  {
    id: 'microservices',
    title: 'Microservices & DB Pipeline',
    description: 'React Client -> API Gateway -> Express Core Logic -> Postgres DB + Redis Cache',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUSIcaNGVFvTR3TfHnhe7fEfcGKbJ9rMjuDJU7D2dIcF54NPkQ5s9Bzz4kck2llzCvnJxRgPpkfc3CsATe3dARAQETfxi4ej1czueQxx_OnEIBWkLFfX9rUpccjFPAr_fTE8q1WD26NfbjFPIH5yoWwTDMLULLNKa3E2HM_H3VWyaGUxjO8SJveCjg2c8X4qnsKCTtEht9DDnBM69NPXfJdR_gvNrxHxiKjNVUf3toR2lcRNu9FW4o',
    data: {
      title: 'Microservices Infrastructure v2',
      summary: 'A standard 3-tier microservice architecture featuring a React SPA client connecting through an NGINX API Gateway with JWT validation, routed to an Express.js Core Backend paired with PostgreSQL and Redis cache.',
      nodes: [
        {
          id: 'client',
          label: 'React Client',
          type: 'frontend',
          tech: 'React 19 + Vite',
          details: { port: '3000', status: '[ OK ]', framework: 'vite', image: 'react-app:v1' },
          x: 80,
          y: 180
        },
        {
          id: 'gateway',
          label: 'API Gateway',
          type: 'gateway',
          tech: 'NGINX / Envoy',
          details: { routes: '/v1/*', auth: 'jwt', port: '8080', status: '[ OK ]' },
          x: 340,
          y: 180
        },
        {
          id: 'core_service',
          label: 'Core Logic Service',
          type: 'backend',
          tech: 'Node.js Express',
          details: { cpu: '45%', status: '[ ACTIVE ]', port: '5000', image: 'node:18-alpine' },
          x: 600,
          y: 180
        },
        {
          id: 'postgres',
          label: 'Postgres DB',
          type: 'database',
          tech: 'PostgreSQL 16',
          details: { pool: '10/20', latency: '12ms', port: '5432' },
          x: 860,
          y: 100
        },
        {
          id: 'redis',
          label: 'Redis Cache',
          type: 'cache',
          tech: 'Redis v7.2',
          details: { memory: '128MB', status: '[ HEALTHY ]', port: '6379' },
          x: 860,
          y: 280
        }
      ],
      edges: [
        { from: 'client', to: 'gateway', label: 'HTTPS / REST', protocol: 'TLS 1.3', style: 'animated', status: 'ok' },
        { from: 'gateway', to: 'core_service', label: 'gRPC / Internal', protocol: 'HTTP/2', style: 'animated', status: 'ok' },
        { from: 'core_service', to: 'postgres', label: 'SQL Query', protocol: 'TCP :5432', style: 'animated', status: 'ok' },
        { from: 'core_service', to: 'redis', label: 'Cache Read/Write', protocol: 'RESP :6379', style: 'animated', status: 'ok' }
      ],
      mermaid: `graph LR
    Client[React Client :3000] -->|HTTPS| Gateway[API Gateway :8080]
    Gateway -->|JWT Auth| Core[Core Logic :5000]
    Core -->|SQL| DB[(Postgres DB :5432)]
    Core -->|RESP| Redis[(Redis Cache :6379)]`,
      architecture_review: {
        strengths: [
          'Clear separation of concerns between ingress gateway and business logic',
          'Redis caching prevents PostgreSQL DB read exhaustion on frequent queries',
          'JWT authentication enforced early at the API Gateway layer'
        ],
        issues: [
          'Single point of failure at Core Logic Service instance without horizontal scaling',
          'Lack of database replica for high-availability read failovers'
        ],
        recommendations: [
          'Add Docker Compose scaling or Kubernetes Deployment with replicaCount >= 2 for Core Logic',
          'Implement health checks (/healthz) on all containerized endpoints',
          'Enforce rate limiting on the API Gateway layer'
        ]
      },
      implementation_plan: [
        { step: 1, task: 'Dockerize Services', description: 'Containerize React frontend, API Gateway, and Express server with multi-stage Dockerfiles.', file_affected: 'Dockerfile' },
        { step: 2, task: 'Configure Gateway Routing', description: 'Define NGINX proxy routes for /v1/api to point to backend container.', file_affected: 'nginx.conf' },
        { step: 3, task: 'Orchestrate via Docker Compose', description: 'Set up network bridge and database persistence volumes in docker-compose.yml.', file_affected: 'docker-compose.yml' }
      ],
      generated_code_snippets: {
        infrastructure_yaml: `# PaperOps Auto-Generated Infrastructure
version: "3.8"

services:
  client:
    image: "react-app:latest"
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8080

  gateway:
    image: "nginx:alpine"
    ports:
      - "8080:80"
    depends_on:
      - core_service

  core_service:
    image: "node:18-alpine"
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgres://user:pass@postgres:5432/main_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: "postgres:16-alpine"
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: main_db
      POSTGRES_USER: user
      POSTGRES_PASSWORD: secretpassword

  redis:
    image: "redis:7-alpine"
    ports:
      - "6379:6379"`,
        docker_compose: `version: "3.8"\nservices:\n  web:\n    build: .\n    ports:\n      - "3000:3000"`
      },
      confidence: 0.96,
      handwriting_clarity: 'clear',
      retry_suggestion: null
    }
  },
  {
    id: 'rag_ai_pipeline',
    title: 'Serverless RAG AI Architecture',
    description: 'User Request -> Fastify Server -> Gemini 3.6 Flash -> Vector Search DB + Storage',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCCwOPU0pIS3LS0vcFpExR5CkOGYsdZ-T7QUoK2klKwsvnUO37MiWCX9ChIi_xYRBZHq_UeWqOZzRke1sCtVUt-VsShu8YHbvnyhBQuzlAtj4i7NI0-ovuXkB7VgGTD1gPRaEfTqWGnZCzHDTTbRIQDydTg15dsMXK_UlB_sreMQQsHgvRHIBgKUSPilOoajxe1Hf2VFoe7lLmbwKauIBW0-4RiPA2cEgLQLK4oO8_CJgzT1JX4OQ8E',
    data: {
      title: 'Serverless RAG & Gemini AI System',
      summary: 'A high-throughput Retrieval-Augmented Generation pipeline. User queries enter an API server, generate embedding vectors, retrieve context from PGVector / Pinecone, and synthesize final grounded answers via Gemini 3.6 Flash.',
      nodes: [
        {
          id: 'user_app',
          label: 'Client App',
          type: 'frontend',
          tech: 'Next.js App Router',
          details: { port: '3000', status: '[ ONLINE ]' },
          x: 100,
          y: 180
        },
        {
          id: 'ai_orchestrator',
          label: 'RAG Orchestrator',
          type: 'backend',
          tech: 'Fastify / Python',
          details: { latency: '8ms', status: '[ ACTIVE ]', port: '8000' },
          x: 360,
          y: 180
        },
        {
          id: 'vector_db',
          label: 'Vector Database',
          type: 'database',
          tech: 'PGVector / Qdrant',
          details: { dimensions: '768', pool: '15/30', port: '6333' },
          x: 640,
          y: 100
        },
        {
          id: 'gemini_engine',
          label: 'Gemini 3.6 Flash',
          type: 'external',
          tech: '@google/genai SDK',
          details: { status: '[ CONNECTED ]', model: 'gemini-3.6-flash' },
          x: 640,
          y: 280
        }
      ],
      edges: [
        { from: 'user_app', to: 'ai_orchestrator', label: 'POST /api/chat', protocol: 'JSON / HTTP', style: 'animated', status: 'ok' },
        { from: 'ai_orchestrator', to: 'vector_db', label: 'Vector Similarity', protocol: 'gRPC', style: 'animated', status: 'ok' },
        { from: 'ai_orchestrator', to: 'gemini_engine', label: 'Prompt + Context', protocol: 'HTTPS API', style: 'animated', status: 'ok' }
      ],
      mermaid: `graph LR
    User[Client App] -->|Query| Orchestrator[RAG Orchestrator]
    Orchestrator -->|Vector Search| VecDB[(Vector DB)]
    Orchestrator -->|Grounding Context| Gemini[Gemini 3.6 Flash]
    Gemini -->|Streaming Tokens| User`,
      architecture_review: {
        strengths: [
          'Leverages Gemini 3.6 Flash for sub-second structured generation and reasoning',
          'Decoupled vector similarity lookup ensures low latency context fetching'
        ],
        issues: [
          'No caching on frequent semantic queries could increase API costs'
        ],
        recommendations: [
          'Add a Redis Semantic Cache in front of vector search',
          'Use stream response (generateContentStream) for instant UI chunk rendering'
        ]
      },
      implementation_plan: [
        { step: 1, task: 'Setup Embedding Pipeline', description: 'Chunk incoming documents and upload vectors using text-embedding model.', file_affected: 'server/embed.ts' },
        { step: 2, task: 'Integrate GenAI SDK', description: 'Initialize GoogleGenAI server-side with User-Agent telemetry headers.', file_affected: 'server/gemini.ts' }
      ],
      generated_code_snippets: {
        infrastructure_yaml: `# RAG AI Pipeline Specification
version: "3.8"
services:
  orchestrator:
    build: .
    environment:
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - VECTOR_DB_URL=http://qdrant:6333
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"`,
        docker_compose: `version: "3.8"`
      },
      confidence: 0.98,
      handwriting_clarity: 'clear',
      retry_suggestion: null
    }
  }
];
