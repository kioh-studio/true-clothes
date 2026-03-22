import 'package:flutter_test/flutter_test.dart';

import 'package:true_clothes_app/main.dart';

void main() {
  testWidgets('Gender onboarding title visible', (WidgetTester tester) async {
    await tester.pumpWidget(const TrueClothesApp());
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));

    expect(find.text('Tell us about you'), findsOneWidget);
  });
}
