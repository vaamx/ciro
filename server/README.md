## Embedding Cache Configuration

By default, the application caches embeddings both in memory and on disk (in the `.cache/embeddings` directory). This improves performance and reduces OpenAI API calls for repeated content.

### Disabling Embedding Cache for Production

For production deployments, it's recommended to disable local disk caching of embeddings to:
- Reduce disk space usage
- Prevent memory inefficiencies
- Support distributed deployments
- Simplify deployment workflows

To disable embedding caching, set the following environment variable:

```
DISABLE_EMBEDDING_CACHE=true
```

When this setting is enabled:
- No embeddings will be stored in the local file system
- The application will rely solely on Qdrant for vector storage
- Each unique piece of content will generate a new embedding via the OpenAI API

### Performance Considerations

Disabling the embedding cache may increase OpenAI API usage and slightly reduce performance for repeated content processing. However, in most production scenarios, the benefits of simplified deployment and reduced disk usage outweigh these considerations. 