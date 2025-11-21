import React from 'react';

interface MarkdownContentProps {
  content: string;
}

const MarkdownContent = ({ content }: MarkdownContentProps) => {
  // Hàm xử lý format text thủ công
  const formatContent = (text: string) => {
    if (!text) return '';

    return text
      // 1. Xử lý in đậm: **text** -> <strong>text</strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-primary">$1</strong>')
      
      // 2. Xử lý in nghiêng: *text* -> <em>text</em>
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // 3. Xử lý danh sách số (ví dụ: 1. ): Xuống dòng + in đậm số
      .replace(/^(\d+\.\s)/gm, '<br/><strong class="mr-1">$1</strong>')
      
      // 4. Xử lý gạch đầu dòng (* ): Xuống dòng + dấu chấm tròn
      .replace(/^\*\s/gm, '<br/>• ')
      
      // 5. Xử lý gạch đầu dòng (- ): Xuống dòng + dấu gạch
      .replace(/^\-\s/gm, '<br/>- ')
      
      // 6. Chuyển đổi ký tự xuống dòng (\n) thành thẻ <br/>
      .replace(/\n/g, '<br/>')
      
      // 7. Xóa bớt các thẻ <br/> dư thừa (nếu có quá nhiều dòng trống liên tiếp)
      .replace(/(<br\/>){3,}/g, '<br/><br/>');
  };

  return (
    <div 
      className="prose prose-sm max-w-none text-secondary-foreground leading-relaxed"
      // Sử dụng dangerouslySetInnerHTML để render chuỗi HTML đã tạo ở trên
      dangerouslySetInnerHTML={{ 
        __html: formatContent(content) 
      }}
    />
  );
};

export default MarkdownContent; 