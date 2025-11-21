from flask import Flask, request, jsonify
import os
import sys
import logging
from datetime import datetime
from flask_cors import CORS
from dotenv import load_dotenv

# 1. Load biến môi trường (API Key)
load_dotenv()

app = Flask(__name__)
CORS(app)  # Fix lỗi CORS cho Frontend
    
# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Thêm đường dẫn để import các module nội bộ (giữ nguyên logic của bạn)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from data import disease_data
    from ai_model.predict import LeafDiseasePredictor
    from rag_llm.llm_response import call_gemini
except ImportError as e:
    logger.error(f"Lỗi import: {e}")
    logger.warning("Đang chạy ở chế độ hạn chế. Vui lòng kiểm tra lại cấu trúc thư mục.")

# Load mô hình AI (Giữ nguyên logic của bạn)
try:
    predictor = LeafDiseasePredictor(
        model_path='ai_model/model.pt',
        label_map_path='ai_model/label_map_vi.json',
        device='auto'
    )
    logger.info("✅ AI Model loaded successfully")
except Exception as e:
    logger.error(f"❌ Failed to load AI Model: {e}")
    predictor = None

class_to_key = {
    "Class_0": "bacterial_leaf_blight",
    "Class_1": "brown_spot",
    "Class_2": "healthy",
    "Class_3": "leaf_blast",
    "Class_4": "leaf_scald",
    "Class_5": "narrow_brown_spot",
}

# Biến toàn cục lưu ngữ cảnh
last_disease_key = None
last_location = None
location_received = False

@app.route("/", methods=["GET"])
def hello():
    return jsonify({"message": "Leaf Whisper Backend is Running!", "status": "ok"})

@app.route("/api/predict", methods=["POST"])
def predict_disease():
    global last_disease_key
    
    logger.info("=" * 80)
    logger.info("📸 [PREDICT] Endpoint called")

    # ---------------------------------------------------------
    # TRƯỜNG HỢP 1: GỬI ẢNH (Logic gốc của bạn)
    # ---------------------------------------------------------
    if "image" in request.files:
        logger.info("🖼️  Processing IMAGE request")
        
        if predictor is None:
            return jsonify({"error": "Mô hình AI chưa được tải (Check log server)"}), 500

        image_file = request.files["image"]
        text_prompt = request.form.get("text", "") # Lấy text đi kèm nếu có
        
        # 1. Lưu ảnh tạm
        if not os.path.exists('temp'):
            os.makedirs('temp')
        image_path = os.path.join('temp', image_file.filename)
        image_file.save(image_path)
        
        try:
            # 2. Predict bệnh bằng Model AI của bạn
            disease_class = predictor.predict(image_path)
            disease_key = class_to_key.get(disease_class, "unknown")
            last_disease_key = disease_key 
            
            logger.info(f"🔬 Predicted class: {disease_class} -> Key: {disease_key}")

            # 3. Lấy thông tin cứng từ file data
            disease_info = disease_data.get(disease_key, {
                "disease_name": "Chưa xác định",
                "details": "Không có dữ liệu chi tiết trong hệ thống.",
                "treatment": "Cần tham vấn chuyên gia.",
                "medications": []
            })

            # 4. Tạo Prompt cho Gemini
            prompt = f"""
            Hệ thống AI nhận diện hình ảnh vừa phát hiện bệnh lúa: {disease_info.get('disease_name')} (Mã: {disease_key}).
            
            Dữ liệu tham khảo:
            - Chi tiết: {disease_info.get('details')}
            - Cách điều trị: {disease_info.get('treatment')}
            - Thuốc: {', '.join(disease_info.get('medications', []))}

            Nhiệm vụ: 
            Hãy đóng vai chuyên gia nông nghiệp, giải thích ngắn gọn cho nông dân về bệnh này và đưa ra phác đồ xử lý ngay lập tức.
            """
            
            if text_prompt:
                prompt += f"\nNgười dùng hỏi thêm: '{text_prompt}'. Hãy trả lời câu này trong lời khuyên."

            if location_received and last_location:
                prompt += f"\nLưu ý: Nông dân đang ở khu vực {last_location}."

            # 5. Gọi Gemini
            logger.info("🤖 Calling Gemini for auto-explanation...")
            gemini_response = call_gemini(prompt)

            # 6. Trả về kết quả GỘP
            result = {
                "is_disease_found": True,
                "disease_key": disease_key,
                "disease_name": disease_info.get('disease_name'),
                # Các trường này quan trọng để Frontend map vào UI
                "details": disease_info.get('details'),
                "treatment": disease_info.get('treatment'),
                "medications": disease_info.get('medications', []),
                
                "static_info": disease_info,
                "ai_advice": gemini_response,
                "message": gemini_response # Dùng field này để hiện text trên chat
            }
            
            return jsonify(result)
        
        except Exception as e:
            logger.error(f"Lỗi xử lý ảnh: {e}")
            return jsonify({"error": str(e)}), 500
        finally:
            # Xóa ảnh tạm
            if os.path.exists(image_path):
                os.remove(image_path)

    # ---------------------------------------------------------
    # TRƯỜNG HỢP 2: CHAT TEXT (Logic bổ sung để không bị lỗi pass)
    # ---------------------------------------------------------
    elif request.json and "text" in request.json:
        user_text = request.json["text"]
        logger.info(f"💬 [CHAT] User Text: {user_text}")
        
        # Xây dựng ngữ cảnh
        context = ""
        if last_disease_key:
            info = disease_data.get(last_disease_key, {})
            context = f"Người dùng đang nói về bệnh '{info.get('disease_name', last_disease_key)}' (vừa gửi ảnh trước đó)."
        
        if location_received and last_location:
            context += f" Tại khu vực: {last_location}."

        prompt = f"""
        Bạn là Leaf Whisper. Ngữ cảnh: {context}
        Câu hỏi: "{user_text}"
        Hãy trả lời ngắn gọn, hữu ích cho nông dân.
        """

        try:
            # Gọi hàm Gemini có sẵn của bạn
            response_text = call_gemini(prompt)
            
            # Trả về JSON đúng format Frontend cần
            return jsonify({
                "message": response_text
            })
        except Exception as e:
            logger.error(f"Chat Error: {e}")
            return jsonify({"message": "Hệ thống đang bận, vui lòng thử lại."})

    else:
        return jsonify({"error": "Vui lòng gửi ảnh hoặc text"}), 400

@app.route("/api/weather", methods=["GET"])
def weather_info():
    global last_location, location_received
    location = request.args.get('location', '').strip()
    
    if location:
        last_location = location
        location_received = True
        return jsonify({"message": f"Đã cập nhật vị trí: {location}"})
    return jsonify({"message": "Chưa có vị trí."})

@app.route("/api/summary", methods=["POST"])
def get_summary():
    global last_disease_key
    if not last_disease_key:
        return jsonify({"error": "Chưa có bệnh nào được phát hiện"}), 400
    
    info = disease_data.get(last_disease_key, {})
    prompt = f"Tóm tắt bệnh {info.get('disease_name')}..."
    
    try:
        res = call_gemini(prompt)
        return jsonify({"summary": res})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("🚀 Starting Flask application...")
    app.run(debug=True, port=5000)