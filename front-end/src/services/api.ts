import { DiseaseOrTextResponse } from '@/types';

// SỬA LỖI: Gán trực tiếp URL, bỏ process.env đi
const API_BASE_URL = 'http://127.0.0.1:5000';

const API_URL = `${API_BASE_URL}/api/predict`;
const WEATHER_API_URL = `${API_BASE_URL}/api/weather`;
const SUMMARY_API_URL = `${API_BASE_URL}/api/summary`;

console.log('🔧 API Configuration:', {
  API_URL,
  WEATHER_API_URL,
  SUMMARY_API_URL
});

interface PredictDiseaseParams {
  text?: string;
  image?: File;
}

interface SummaryResponse {
  summary?: string;
  error?: string;
}

// src/services/api.ts
// ... (giữ nguyên các phần khác)

export const predictDisease = async ({ text, image }: PredictDiseaseParams): Promise<DiseaseOrTextResponse> => {
  try {
    const formData = new FormData();

    if (image) {
      formData.append('image', image);
      if (text) formData.append('text', text);
    } else {
      // QUAN TRỌNG: Nếu không có ảnh, gửi JSON để backend hiểu là chat thường
      return await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ text }),
        headers: { 'Content-Type': 'application/json' },
      }).then(res => res.json());
    }

    // Gửi ảnh (FormData)
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Lỗi API');
    return await response.json();
  } catch (error) {
    console.error('Lỗi:', error);
    throw error;
  }
};

export const getSummary = async (): Promise<SummaryResponse> => {
  try {
    const response = await fetch(SUMMARY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Lỗi khi lấy tóm tắt');
    }

    return await response.json();
  } catch (error) {
    console.error('Lỗi khi lấy tóm tắt:', error);
    throw error;
  }
};

export const getWeatherData = async (location: string) => {
  try {
    const response = await fetch(`${WEATHER_API_URL}?location=${encodeURIComponent(location)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Lỗi khi lấy dữ liệu thời tiết từ server');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu thời tiết:', error);
    throw error;
  }
};
