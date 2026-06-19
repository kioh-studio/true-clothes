## Feature

- Giúp user mua sắm tốt hơn bằng cách kiểm tra xem item định mua có phù hợp với mình không
- App sẽ đánh giá qua các tiêu chí : item có phù hợp với bản thân qua màu sắc, fit, measurement, style
- Sau đó sẽ kiểm tra xem match với item nào trong tủ đồ để tạo thành các outfit
## Flow

- User scan tấm hình của item định mua bằng camera hay lấy từ libary 
- App sẽ call edge func để export tấm ảnh này ra kèm các info tương ứng
- Các info này sẽ hiển thị trong trang result luôn
- Từ các info này, sẽ chạy qua 1 edge func để đánh giá món đồ hợp ới user không, trên thang điểm 100. Đây là mục Verdict:
  - Màu sắc
  - Style 
  - Fit
  - Measurement
  - Fabric
- Đồng thời có nút Mix & Match để navigate qua màn hình phối item đó với những item trong tủ đồ để tạo thành outfit, để user thấy item đó phối với tủ đ của mình thế nào. Lưu ý chỉ phối xoay
quanh item đó thôi, nghĩa là tất cả outfit gen ra đều phải có item đ

- Sau khi xong, nếu user hài lòng và bấm add thì sẽ thêm vào tủ đồ. Không thì bấm bấm No sẽ back về màn hình scan

- Follow các screen từ file screens/True Clothes Try On.zip để biết UI như thế nào, build compatible với UI đó, lấy UI đó làm đầu

## Note

- Các info là do AI extract, nếu có info nào không thể lấy thì để null
- Extract item về là dạng cut off background, nên display dạng đó luôn
- Item scan chưa được add vào wardrobe, chỉ khi nhấn add mới thêm vào.
- Follow mục đích của feature này, nếu có gì không clear hay nghĩ cần enhance thì hỏi tôi