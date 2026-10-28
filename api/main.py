import os
import json
import base64
import requests
from io import BytesIO
from PIL import Image
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Coloque a sua chave da Groq aqui (começa com gsk_...)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "COLOQUE_SUA_CHAVE_AQUI_LOCALMENTE")

@app.post("/analisar")
async def analisar_imagem(file: UploadFile = File(...)):
    try:
        conteudo_imagem = await file.read()
        
        # OTIMIZAÇÃO: Reduzir resolução e tamanho para economizar tokens
        img = Image.open(BytesIO(conteudo_imagem))
        
        # Converte para RGB caso a imagem seja PNG com fundo transparente
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        # Redimensiona mantendo a proporção (máximo de 800x800)
        img.thumbnail((800, 800)) 
        
        # Salva em memória como JPEG otimizado
        buffered = BytesIO()
        img.save(buffered, format="JPEG", quality=85)
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Forçamos o mime type para jpeg, pois convertemos acima
        tipo_mime = "image/jpeg"

        prompt = (
            "Você é um classificador visual rigoroso e não deve inventar informações. "
            "1. LEIA atentamente qualquer texto ou marca visível no rótulo do objeto antes de o classificar. "
            "2. Diferencie claramente objetos cilíndricos: verifique se é uma 'Pilha/Bateria' (energia) ou uma 'Lata de Alumínio' (bebidas/alimentos). "
            "3. Atribua a categoria técnica correta (ex: Resíduo Perigoso · Descarte Especial para pilhas e baterias). "
            "4. Forneça 3 passos de descarte seguros, lógicos e reais (sem inventar procedimentos irreais). "
            "Retorne APENAS um JSON válido neste formato: "
            '{"material": "Nome", "categoria": "Categoria", "instrucoes": ["Passo 1", "Passo 2", "Passo 3"]}'
        )

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        # Payload com o parâmetro temperature adicionado
        payload = {
            "model": "qwen/qwen3.8-27b",
            "max_tokens": 300,
            "temperature": 0.1, # Reduz a criatividade a quase zero para garantir respostas lógicas e exatas
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{tipo_mime};base64,{img_base64}"}}
                    ]
                }
            ]
        }

        print("A enviar imagem otimizada para a API da Groq...")
        response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
        
        if response.status_code != 200:
            erro_groq = response.json().get('error', {}).get('message', response.text)
            raise Exception(f"Groq Rejeitou: {erro_groq}")

        resposta_ia = response.json()["choices"][0]["message"]["content"]
        
        texto_limpo = resposta_ia.replace("```json", "").replace("```", "").strip()
        resultado = json.loads(texto_limpo)
        
        print("IA Groq detetou:", resultado["material"])
        return resultado

    except Exception as e:
        mensagem_erro = str(e)
        print("ERRO DETALHADO NO PYTHON:", mensagem_erro)
        return {
            "material": "Erro na IA",
            "categoria": "Verifique o erro abaixo",
            "instrucoes": [
                "O servidor da Groq devolveu o seguinte erro:",
                mensagem_erro[:200], 
                "Tente novamente."
            ]
        }

app.mount("/", StaticFiles(directory="../", html=True), name="site")