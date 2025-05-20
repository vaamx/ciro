Voice agents
Learn how to build voice agents that can understand audio and respond back in natural language.

Use the OpenAI API and Agents SDK to create powerful, context-aware voice agents for applications like customer support and language tutoring. This guide helps you design and build a voice agent.
Choose the right architecture

OpenAI provides two primary architectures for building voice agents:

    Speech-to-speech (multimodal)
    Chained (speech-to-text → LLM → text-to-speech)

Speech-to-speech (multimodal) architecture

The multimodal speech-to-speech (S2S) architecture directly processes audio inputs and outputs, handling speech in real time in a single multimodal model, gpt-4o-realtime-preview. The model thinks and responds in speech. It doesn't rely on a transcript of the user's input—it hears emotion and intent, filters out noise, and responds directly in speech. Use this approach for highly interactive, low-latency, conversational use cases.
Strengths	Best for
Low latency interactions	Interactive and unstructured conversations
Rich multimodal understanding (audio and text simultaneously)	Language tutoring and interactive learning experiences
Natural, fluid conversational flow	Conversational search and discovery
Enhanced user experience through vocal context understanding	Interactive customer service scenarios
Chained architecture

A chained architecture processes audio sequentially, converting audio to text, generating intelligent responses using large language models (LLMs), and synthesizing audio from text. We recommend this predictable architecture if you're new to building voice agents. Both the user input and model's response are in text, so you have a transcript and can control what happens in your application. It's also a reliable way to convert an existing LLM-based application into a voice agent.

You're chaining these models: gpt-4o-transcribe → gpt-4o → gpt-4o-mini-tts
Strengths	Best for
High control and transparency	Structured workflows focused on specific user objectives
Robust function calling and structured interactions	Customer support
Reliable, predictable responses	Sales and inbound triage
Support for extended conversational context	Scenarios that involve transcripts and scripted responses
Build a voice agent

Use OpenAI's APIs and SDKs to create powerful, context-aware voice agents.
Use a speech-to-speech architecture for realtime processing

Building a speech-to-speech voice agent requires:

    Establishing a connection for realtime data transfer
    Creating a realtime session with the Realtime API
    Using an OpenAI model with realtime audio input and output capabilities

To get started, read the Realtime API guide and the Realtime API reference. Compatible models include gpt-4o-realtime-preview and gpt-4o-mini-realtime-preview.
Chain together audio input → text processing → audio output

The Agents SDK supports extending your existing agents with voice capabilities. Get started by installing the OpenAI Agents SDK for Python with voice support:

pip install openai-agents[voice]

See the Agents SDK voice agents quickstart in GitHub to follow a complete example.

In the example, you'll:

    Run a speech-to-text model to turn audio into text.
    Run your code, which is usually an agentic workflow, to produce a result.
    Run a text-to-speech model to turn the result text back into audio.
