import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:true_clothes_app/main.dart';

void main() {
  testWidgets('Gender onboarding title visible', (WidgetTester tester) async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({'onboarding_complete': false});

    await tester.pumpWidget(const TrueClothesApp());
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));

    expect(find.text('Tell us about you'), findsOneWidget);
  });
}
