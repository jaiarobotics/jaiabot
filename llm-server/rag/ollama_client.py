import requests
import json

def query_model(question: str, context: str, model: str = "mistral") -> str:
    prompt = f"""You are a helpful chatbot to help people get information from the jaiabot documentation.
    Use the provided context to answer the question. Do not hallucinate.

    Context:
    {context}

    Question: {question}
    Answer:"""

    resp = requests.post(
        "http://localhost:11434/api/chat",
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True  # important
        },
        stream=True,
    )

    answer = []
    for line in resp.iter_lines():
        if not line:
            continue
        data = json.loads(line.decode("utf-8"))
        if "message" in data and "content" in data["message"]:
            answer.append(data["message"]["content"])
        if data.get("done"):
            break

    return "".join(answer).strip()
