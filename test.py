import google.generativeai as genai

genai.configure(api_key="AIzaSyAXcp6lWZONjioo3g7EWpe4pJRy20vNKo0")

try:
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content("Hello, can you hear me?")
    print("API hoạt động OK!")
    print("Phản hồi:", response.text)
except Exception as e:
    print("API lỗi:", e)
