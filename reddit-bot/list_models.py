import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('GEMINI_API_KEY')
print(f"Key found: {bool(api_key)}")

if api_key:
    genai.configure(api_key=api_key)
    print("Listing models...")
    with open('models.txt', 'w') as f:
        try:
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    f.write(f"{m.name}\n")
                    print(f"Model: {m.name}")
        except Exception as e:
            f.write(f"Error: {e}\n")
