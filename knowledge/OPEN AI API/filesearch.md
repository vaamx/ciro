File search
Allow models to search your files for relevant information before generating a response.
Overview

File search is a tool available in the Responses API. It enables models to retrieve information in a knowledge base of previously uploaded files through semantic and keyword search. By creating vector stores and uploading files to them, you can augment the models' inherent knowledge by giving them access to these knowledge bases or vector_stores.

To learn more about how vector stores and semantic search work, refer to our retrieval guide.

This is a hosted tool managed by OpenAI, meaning you don't have to implement code on your end to handle its execution. When the model decides to use it, it will automatically call the tool, retrieve information from your files, and return an output.
How to use

Prior to using file search with the Responses API, you need to have set up a knowledge base in a vector store and uploaded files to it.
Create a vector store and upload a file

Once your knowledge base is set up, you can include the file_search tool in the list of tools available to the model, along with the list of vector stores in which to search.

At the moment, you can search in only one vector store at a time, so you can include only one vector store ID when calling the file search tool.
File search tool

import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: "What is deep research by OpenAI?",
    tools: [{
        type: "file_search",
        vector_store_ids: ["<vector_store_id>"],
    }],
});
console.log(response);

When this tool is called by the model, you will receive a response with multiple outputs:

    A file_search_call output item, which contains the id of the file search call.
    A message output item, which contains the response from the model, along with the file citations.

File search response

{
  "output": [
    {
      "type": "file_search_call",
      "id": "fs_67c09ccea8c48191ade9367e3ba71515",
      "status": "completed",
      "queries": ["What is deep research?"],
      "search_results": null
    },
    {
      "id": "msg_67c09cd3091c819185af2be5d13d87de",
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "Deep research is a sophisticated capability that allows for extensive inquiry and synthesis of information across various domains. It is designed to conduct multi-step research tasks, gather data from multiple online sources, and provide comprehensive reports similar to what a research analyst would produce. This functionality is particularly useful in fields requiring detailed and accurate information...",
          "annotations": [
            {
              "type": "file_citation",
              "index": 992,
              "file_id": "file-2dtbBZdjtDKS8eqWxqbgDi",
              "filename": "deep_research_blog.pdf"
            },
            {
              "type": "file_citation",
              "index": 992,
              "file_id": "file-2dtbBZdjtDKS8eqWxqbgDi",
              "filename": "deep_research_blog.pdf"
            },
            {
              "type": "file_citation",
              "index": 1176,
              "file_id": "file-2dtbBZdjtDKS8eqWxqbgDi",
              "filename": "deep_research_blog.pdf"
            },
            {
              "type": "file_citation",
              "index": 1176,
              "file_id": "file-2dtbBZdjtDKS8eqWxqbgDi",
              "filename": "deep_research_blog.pdf"
            }
          ]
        }
      ]
    }
  ]
}

Retrieval customization
Limiting the number of results

Using the file search tool with the Responses API, you can customize the number of results you want to retrieve from the vector stores. This can help reduce both token usage and latency, but may come at the cost of reduced answer quality.
Limit the number of results

const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: "What is deep research by OpenAI?",
    tools: [{
        type: "file_search",
        vector_store_ids: ["<vector_store_id>"],
        max_num_results: 2,
    }],
});
console.log(response);

Include search results in the response

While you can see annotations (references to files) in the output text, the file search call will not return search results by default.

To include search results in the response, you can use the include parameter when creating the response.
Include search results

const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: "What is deep research by OpenAI?",
    tools: [{
        type: "file_search",
        vector_store_ids: ["<vector_store_id>"],
    }],
    include: ["file_search_call.results"],
});
console.log(response);

Metadata filtering

You can filter the search results based on the metadata of the files. For more details, refer to our retrieval guide, which covers:

    How to set attributes on vector store files
    How to define filters

Metadata filtering

const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: "What is deep research by OpenAI?",
    tools: [{
        type: "file_search",
        vector_store_ids: ["<vector_store_id>"],
        filters: {
            type: "eq",
            key: "type",
            value: "blog"
        }
    }]
});
console.log(response);

Supported files

For text/ MIME types, the encoding must be one of utf-8, utf-16, or ascii.
File format	MIME type
.c	text/x-c
.cpp	text/x-c++
.cs	text/x-csharp
.css	text/css
.doc	application/msword
.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document
.go	text/x-golang
.html	text/html
.java	text/x-java
.js	text/javascript
.json	application/json
.md	text/markdown
.pdf	application/pdf
.php	text/x-php
.pptx	application/vnd.openxmlformats-officedocument.presentationml.presentation
.py	text/x-python
.py	text/x-script.python
.rb	text/x-ruby
.sh	application/x-sh
.tex	text/x-tex
.ts	application/typescript
.txt	text/plain
Limitations

Below are some usage limitations on file search that implementors should be aware of.

    Projects are limited to a total size of 100GB for all Files
    Vector stores are limited to a total of 10k files
    Individual files can be a max of 512MB (roughly 5M tokens per file)
