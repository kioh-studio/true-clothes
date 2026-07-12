# Body shape nên nặng bao nhiêu ký trong scoring? — Báo cáo INTERIM

**Ngày:** 2026-07-06
**Trạng thái:** INTERIM — verify dở dang, phase synthesize CHƯA chạy
**Tiến độ:** 9 claim confirmed (3-0) / 1 claim refuted (0-3) / 15 claim unverified (lỗi limit, chưa có vote hợp lệ)

## Câu hỏi nghiên cứu

Body shape (hourglass/pear/apple/rectangle/inverted-triangle) nên được các stylist chuyên nghiệp, nhà giáo dục thời trang và ngành thời trang coi trọng đến mức nào khi phối đồ và gợi ý trang phục? Cụ thể cần trả lời:

1. Khung lý thuyết "dress for your body shape" cổ điển (A-line cho pear, nhấn eo cho hourglass...) được stylist chuyên nghiệp thực tế coi trọng đến đâu so với các yếu tố khác (màu sắc, phong cách cá nhân, sở thích về fit, dịp mặc, tỷ lệ cơ thể, xu hướng hiện tại)?
2. Các phê phán hiện đại — liệu "dress for your body type" có bị coi là lỗi thời/có hại không, và stylist hiện đại dùng gì thay thế (hệ Kibbe, lý thuyết đường nét/tỷ lệ, "style essence", body neutrality)?
3. Bằng chứng thực tế về việc người tiêu dùng phản ứng thế nào với lời khuyên về fit/styling, và điều gì thực sự quyết định sự hài lòng khi mua hàng về fit?
4. Các app/dịch vụ styling công nghệ (Stitch Fix, các app AI cá nhân hoá) đánh trọng số body shape trong thuật toán gợi ý ra sao (nếu có thông tin)?

Mục tiêu: quyết định mức trọng số hợp lý cho body shape trong (a) engine phối đồ generate-outfits (hiện ~1% tổng điểm) và (b) engine đánh giá item định mua evaluate-item (hiện ~2.5-5%).

---

## 1. Phát hiện đã kiểm chứng (3-0 votes)

1. **Fit/sizing và comfort là tiêu chí đánh giá quan trọng nhất, vượt trội các yếu tố khác.** Khảo sát 316 phụ nữ Nam Phi đánh giá trang phục thường ngày cho thấy fit/sizing và comfort là tiêu chí quan trọng nhất trên cả 3 loại trang phục (áo blouse/top, chân váy/quần, đầm), vượt trội có ý nghĩa thống kê so với style/thiết kế, màu sắc/hoạ tiết, ngoại hình, tính phù hợp và chất liệu.
   Nguồn: https://intellectdiscover.com/content/journals/10.1386/fspc_00117_1
   Quote: "Across all three clothing categories, fit/sizing and comfort were the most important evaluative criteria, statistically equally important and differ significantly from the proportions of other evaluative criteria..."

2. **Mối liên hệ giữa body shape tự nhận thức và tiêu chí ưu tiên khi mua là có ý nghĩa thống kê nhưng effect size nhỏ.** Tức là body shape chỉ điều biến nhẹ các tiêu chí mua hàng so với các yếu tố phổ quát như fit và comfort.
   Nguồn: https://intellectdiscover.com/content/journals/10.1386/fspc_00117_1
   Quote: "These associations were small but significant, and South African fashion designers may need to consider that women with these body shapes may be less satisfied with current casual retail clothing designs"

3. **Ngành công nghiệp apparel: nguyên nhân gốc rễ của thất vọng về fit là brand KHÔNG hiểu body shape, chứ không phải hệ thống size/số đo kém.** Đây là nguồn industry (Alvanon-adjacent, sách chương ngành) cho rằng fit kém là rào cản lớn với thương mại online, và gốc rễ là thiếu hiểu biết về body shape — hàm ý body shape là biến quan trọng về mặt thực tiễn ngành đối với sự hài lòng về fit khi mua hàng.
   Nguồn: https://www.sciencedirect.com/science/article/abs/pii/B9781782422105500013
   Quote: "Apparel fit remains a major consumer frustration and barrier to online sales growth, not because of sizes and measurements, but because few brands and retailers properly understand and address body shape."

4. **Sự hài lòng về fit phần thân dưới có tương quan có ý nghĩa thống kê với "cathexis" (cảm xúc/thái độ) về cơ thể phần thân dưới.** Nghiên cứu trên 107 phụ nữ tiêu dùng cho thấy sự hài lòng về fit không chỉ do hình học trang phục quyết định, mà còn do tâm lý/cảm nhận về cơ thể — hàm ý can thiệp cải thiện fit-satisfaction cần tính đến cảm nhận của người dùng về từng vùng cơ thể, không chỉ số đo khách quan.
   Nguồn: https://journals.sagepub.com/doi/10.1177/0887302X9000800206
   Quote: "Correlation for lower body fit satisfaction and lower body cathexis was statistically significant, confirming a relationship between the respondents' satisfaction with fit and feelings towards personal body."

5. **Song & Ashdown (2013): body shape tự khai của người tiêu dùng KHÔNG đáng tin cậy** vì nó dựa trên nhận thức chủ quan chứ không phải số đo — hàm ý một app không nên hoàn toàn tin vào nhãn body shape do người dùng tự chọn làm input chấm điểm.
   Nguồn: https://www.researchgate.net/publication/274167953_Female_Apparel_Consumers'_Understanding_of_Body_Size_and_Shape_Relationship_Among_Body_Measurements_Fit_Satisfaction_and_Body_Cathexis
   Quote: "response to their body shape is based on personal perceptions and subjective judgments of their own body which may impact reliability" (Song & Ashdown, 2013)

6. **Cùng nghiên cứu trên: mô hình hoá sự hài lòng về fit gắn với "body cathexis" và tự nhận thức tại từng vị trí cơ thể**, vì các công ty apparel gặp khó khăn khi hiểu fit từ góc nhìn người tiêu dùng — tức sự hài lòng về fit bị chi phối bởi thái độ với cơ thể, không chỉ khớp số đo khách quan.
   Nguồn: https://www.researchgate.net/publication/274167953_Female_Apparel_Consumers'_Understanding_of_Body_Size_and_Shape_Relationship_Among_Body_Measurements_Fit_Satisfaction_and_Body_Cathexis
   Quote: "This study also analyzed the relationship between garment fit satisfaction, body cathexis, and self-perception for each body location because apparel companies have had difficulty in understanding fit from the consumer's perspective."

7. **Stitch Fix KHÔNG mô hình hoá fit như một nhãn body-shape phân loại (categorical), mà là một đặc trưng ẩn (latent) đa chiều** cho từng khách hàng và từng sản phẩm, do thuật toán tự học.
   Nguồn: https://algorithms-tour.stitchfix.com/
   Quote: "in this illustration we're treating fit as unidimensional for simplicity, but in fact at Stitch Fix we treat it as multidimensional"

8. **Vị trí fit của khách hàng và sản phẩm được suy luận từ dữ liệu hành vi (phản hồi về fit, lịch sử mua hàng)**, chứ không chỉ từ size khai báo hay body-shape tự nhận.
   Nguồn: https://algorithms-tour.stitchfix.com/
   Quote: "With clients' fit feedback and purchase histories, we can learn where particular clients and styles fall along this spectrum."

9. **Thông tin size tự khai bị coi là không đủ chính xác cho việc match fit**, đây là động lực để Stitch Fix ưu tiên fit preference học được thay vì các category size/body cố định.
   Nguồn: https://algorithms-tour.stitchfix.com/
   Quote: "a new client may tell us that she wears medium-sized blouses, but where exactly would her preference fall along the spectrum of smallish mediums to largish mediums?"

---

## 2. Claim bị bác bỏ

**Bị bác 0-3 (KHÔNG đứng vững):**

> Claim gốc: "Bài blog 2023 của Stitch Fix về pipeline generative-AI liệt kê phản hồi văn bản của khách hàng về fit, sở thích style, dịp mặc là input chính cho gợi ý, nhưng KHÔNG hề nhắc đến các category body-shape (hourglass/pear/apple/rectangle) hay số đo cơ thể — ngụ ý công ty định hình cá nhân hoá quanh phản hồi fit/style biểu đạt chứ không phải khung body-shape hình học."

Nguồn: https://newsroom.stitchfix.com/blog/how-were-revolutionizing-personal-styling-with-generative-ai/

Ý nghĩa của việc bị bác: claim này KHÔNG đứng vững sau adversarial verify. Nguồn Stitch Fix 2023 về generative AI thực ra không chứng minh được điều claim khẳng định (rằng body-shape/số đo hoàn toàn vắng mặt khỏi bài viết đó). Nói cách khác, không thể dùng bài blog 2023 này làm bằng chứng rằng Stitch Fix đã loại bỏ body-shape khỏi các input cá nhân hoá của họ — claim suy diễn quá xa so với nội dung nguồn thực tế.

---

## 3. Chưa kiểm chứng (15 claim — chỉ do hết limit, KHÔNG phải bị bác)

Các claim dưới đây chưa có vote hợp lệ nào (đều bị lỗi/timeout khi hệ thống hết session token limit ở lần chạy verify). Đây KHÔNG phải là bị bác bỏ — chỉ đơn giản là chưa được kiểm chứng.

### Nhóm ViBE paper (arxiv 1912.06697 — body-shape-aware recsys)

1. Trên dữ liệu catalog thực tế, recommendation biết body-shape (ViBE) vượt trội hơn embedding không biết body-shape khoảng 7-10 điểm AUC khi dự đoán độ phù hợp trang phục cho người/sản phẩm chưa từng thấy (đầm: 0.65 vs 0.55 AUC; áo: 0.60 vs 0.53 AUC) — cho thấy body shape mang tín hiệu đo được nhưng ở mức vừa phải. Nguồn: arxiv.org/pdf/1912.06697
2. Bài báo khẳng định các hệ thống gợi ý thời trang chủ đạo (tính đến 2019-2020) phần lớn bỏ qua hoàn toàn body shape, theo kiểu "one shape fits all" do thiên lệch dữ liệu (dataset) nghiêng về người mẫu gầy/cao. Nguồn: arxiv.org/pdf/1912.06697
3. Vấn đề fit được cho là nguyên nhân hàng đầu gây trả hàng online và là yếu tố quyết định thường xuyên trong quyết định mua — ủng hộ việc đặt trọng số body-shape/fit cao hơn khi đánh giá mua hàng so với khi phối đồ tổng quát. Nguồn: arxiv.org/pdf/1912.06697
4. Lợi thế của recommendation biết body-shape không đồng đều: tăng mạnh với trang phục "kén dáng" (ví dụ đầm bó sát), nhỏ hơn với trang phục hợp mọi dáng người — ngụ ý nên đánh trọng số body-shape có điều kiện theo loại trang phục, thay vì một hệ số cố định. Nguồn: arxiv.org/pdf/1912.06697

### Nhóm Kibbe/stylist hiện đại (phê phán body-shape rules)

5. Sách "Metamorphosis" (1987) của David Kibbe giới thiệu hệ 13 kiểu dáng cơ thể trên phổ yin/yang (cong vs góc cạnh) qua 5 nhóm (dramatic, classic, natural, gamine, romantic); hệ này trở lại phổ biến vào thập niên 2020 qua mạng xã hội — ủng hộ tiền đề rằng Kibbe là một hệ thay thế đang sống cho khung "hình quả" cổ điển. Nguồn: en.wikipedia.org/wiki/Dressing_by_body_type_in_women
6. Một nhà giáo dục thời trang chuyên nghiệp (sáng lập Australian Style Institute) cho rằng các category body-shape cổ điển chỉ có giá trị hạn chế: biết category có thể hữu ích nhưng chỉ như một hướng dẫn tổng quát, không phải một giải pháp/chiến lược styling cá nhân hoá. Nguồn: fashionjournal.com.au/fashion/dressing-for-body-type/
7. Stylist hiện đại coi các quy tắc body-shape là gánh nặng tâm lý và phi thực tế với người tiêu dùng — tức khung "dress for your body type" bị coi là có hại, không chỉ lỗi thời. Nguồn: fashionjournal.com.au/fashion/dressing-for-body-type/
8. Stylist cho rằng nên thay các quy tắc body-shape tổng quát bằng thông tin cá nhân hoá khớp với size/độ sẵn có thời trang hiện tại — ngụ ý hệ thống gợi ý nên ưu tiên dữ liệu fit cá nhân hoá hơn là quy tắc theo category body-shape. Nguồn: fashionjournal.com.au/fashion/dressing-for-body-type/
9. Hệ thống "hình quả" cổ điển (hourglass/pear/apple/rectangle/inverted-triangle) được xây trên tiền đề hourglass là silhouette lý tưởng và ăn mặc đẹp nghĩa là tiệm cận nó — khiến mọi lời khuyên mang tính "sửa lỗi" (corrective). Nguồn: joellecq.co/post/your-body-shape-and-your-kibbe-type-are-not-the-same-thing
10. Một category body-shape cổ điển không đủ để quyết định styling: người cùng một category "hình quả" có thể thuộc nhiều kiểu Kibbe khác nhau vì đường nét/tỷ lệ/ấn tượng thị giác thực sự khác nhau — ngụ ý category body-shape đơn lẻ có giá trị dự đoán thấp về việc gì sẽ đẹp. Nguồn: joellecq.co/post/your-body-shape-and-your-kibbe-type-are-not-the-same-thing
11. Thực hành stylist hiện đại (theo tác giả này) thay thế cách "sửa lỗi" dựa trên thiếu sót cơ thể bằng phân tích dựa trên đường nét (Kibbe yin/yang) — hỏi cơ thể tự nhiên tạo ra đường nét gì, nhằm hài hoà trang phục với sự cân bằng tự nhiên của cơ thể thay vì áp đặt lên nó. Nguồn: joellecq.co/post/your-body-shape-and-your-kibbe-type-are-not-the-same-thing

### Nhóm Stitch Fix onboarding

12. Stitch Fix thu thập body shape như một trong khoảng 5 nhóm input rõ ràng trong hồ sơ style khi onboarding (số đo, size, body shape, sở thích style/fit, giá cả), qua bảng hỏi ~10 phút — tức body shape là một feature hồ sơ hạng nhất nhưng không chi phối. Nguồn: digit.hbs.org/submission/stitch-fix-a-marriage-of-art-and-science
13. Trong hệ thống Stitch Fix, gợi ý của thuật toán (có tính đến body-shape) không phải là quyết định cuối: một stylist con người review output AI và ra lựa chọn sản phẩm cuối cùng — cho thấy ngay cả một dịch vụ styling nặng về dữ liệu cũng không để thuộc tính hồ sơ như body shape tự động chi phối kết quả. Nguồn: digit.hbs.org/submission/stitch-fix-a-marriage-of-art-and-science

### Nhóm fit-returns / hướng dẫn body-shape cổ điển

14. Ngay cả một hướng dẫn dress-by-body-shape chuyên biệt cũng tự giới hạn tầm quan trọng của khung lý thuyết này, nói rằng lý thuyết body-shape ở một mức độ nào đó đã lỗi thời và tốt nhất nên coi là công cụ hạn chế để che/cân bằng vài bộ phận cơ thể cụ thể, chứ không phải hệ thống styling toàn diện. Nguồn: theconceptwardrobe.com/build-a-wardrobe/hourglass-body-shape
15. Quy tắc cổ điển cho dáng hourglass dựa trên nguyên tắc cân bằng: giữ tỷ lệ tự nhiên của cơ thể bằng cách mặc phần trên và dưới cân xứng và tôn phần eo thon. Nguồn: theconceptwardrobe.com/build-a-wardrobe/hourglass-body-shape

---

## 4. Nhận định sơ bộ (CHƯA chốt — chờ verify xong)

Dựa trên 9 claim đã confirm (chưa có synthesis chính thức), có thể nêu trung thực các điểm sau:

- **Fit/sizing và comfort là tiêu chí mua hàng thống trị**, vượt trội rõ so với các yếu tố khác kể cả màu sắc/style/hoạ tiết (claim #1).
- **Body shape chỉ điều biến các tiêu chí mua hàng ở mức nhỏ (effect size nhỏ)** khi xét như một biến thống kê tách biệt (claim #2) — nhưng đồng thời **một nguồn industry (Alvanon-adjacent) đã được confirm 3-0** rằng nguyên nhân gốc rễ của thất vọng về fit trong ngành là brand không hiểu/đáp ứng body shape (claim #3). Hai claim này không hoàn toàn mâu thuẫn nhưng phản ánh hai góc nhìn khác nhau (thống kê khảo sát người dùng vs. quan sát thực tiễn ngành) và CHƯA được tổng hợp/đối chiếu.
- **Stitch Fix không dùng category body-shape cứng làm cơ sở tính fit**, mà học "fit" như một đặc trưng ẩn đa chiều từ phản hồi hành vi/lịch sử mua hàng, xem size/thông tin tự khai là không đủ chính xác (claim #7, #8, #9).
- **Body shape tự khai của người dùng không đáng tin cậy** — nên nếu dùng, nên ưu tiên số đo thực tế hơn nhãn tự chọn (claim #5, #6).

**Hàm ý sơ bộ cho MIEN** (rất tạm thời, chưa nên coi là kết luận cuối):

- Mức ~1% hiện tại trong generate-outfits có vẻ **thấp hơn** mức mà evidence đã confirm ủng hộ — vì có nguồn industry đủ mạnh (3-0) cho rằng hiểu body shape là gốc rễ giải quyết fit-frustration.
- Nhưng evidence hiện có cũng **không ủng hộ đẩy trọng số lên quá cao/thành tiêu chí thống trị** — vì fit/comfort tổng quát (không nhất thiết gắn với category "hình quả") mới là yếu tố áp đảo, và effect size của riêng body-shape-category là nhỏ.
- Vùng hợp lý sơ bộ (rất tạm): có thể cân nhắc nâng ảnh hưởng của body shape lên **vài phần trăm** (thay vì ~1%) và/hoặc bổ sung **hard-penalty cho các trường hợp mismatch rõ ràng** (ví dụ item được thiết kế corrective mà đi ngược hẳn với dáng người), đồng thời **ưu tiên số đo thực tế (measurements)** hơn là nhãn body-shape tự khai khi có thể.
- **CẢNH BÁO QUAN TRỌNG:** đây chỉ là nhận định sơ bộ dựa trên 9/25 claim đã verify. 15 claim còn chưa verify — đặc biệt là **con số AUC của ViBE** (7-10 điểm AUC, nếu đúng sẽ là bằng chứng định lượng mạnh nhất trong toàn bộ nghiên cứu ủng hộ trọng số cao hơn) và **các phê phán từ stylist hiện đại** (cho rằng category body-shape có giá trị dự đoán thấp, nên thay bằng line/proportion theory) — có thể **thay đổi đáng kể** kết luận cuối cùng theo cả hai hướng. Không nên chốt mức trọng số cụ thể trước khi các claim này được verify và synthesis chạy xong.

---

## 5. Cách chạy tiếp

- Run ID: `wf_60624dc6-813`; script: `C:\Users\PC\.claude\projects\C--projects-true-clothes\960b15f2-6513-4328-9fcd-bab14916818e\workflows\scripts\deep-research-wf_60624dc6-813.js` (LƯU Ý: thư mục session cũ có thể bị dọn — nếu mất, dùng phương án B).
- Phương án A (resume nguyên bản, chạy trên Fable — ~46 agent còn lại + synthesize): resume Workflow với scriptPath + resumeFromRunId như trên, args giữ nguyên. Tốn quota Fable nhiều.
- Phương án B (khuyến nghị, rẻ hơn): chạy script continuation `C:\projects\true-clothes\scripts\research\body-shape-verify-continue.workflow.js` — chỉ verify 15 claim còn lại bằng Sonnet (1 vote/claim thay vì 3) + synthesize bằng Sonnet trên toàn bộ state. Dữ liệu vào: `docs/research/body-shape-research-state.json`.
- Bài học cost: deep-research mặc định chạy mọi agent bằng model của session (Fable) — 3 vote/claim × ~24 claim × Fable đốt ~1.86M token và 2 lần chạm limit. Lần sau với research kiểu này nên yêu cầu verify bằng Sonnet/Haiku ngay từ đầu.
