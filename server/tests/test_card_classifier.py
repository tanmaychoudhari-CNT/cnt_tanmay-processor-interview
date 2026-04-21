import pytest

from app.services.card_classifier import CardValidationError, classify_card


class TestClassifyCard:
    @pytest.mark.parametrize(
        "raw, expected_number, expected_type",
        [
            ("4267628872390355", "4267628872390355", "Visa"),
            ("5553959204036891", "5553959204036891", "MasterCard"),
            ("6714744990978278", "6714744990978278", "Discover"),
            ("3336208249795480", "3336208249795480", "Amex"),
            # Non-digits get stripped.
            ("4267-6288-7239-0355", "4267628872390355", "Visa"),
            ("  5553 9592 0403 6891  ", "5553959204036891", "MasterCard"),
        ],
    )
    def test_valid_cards(self, raw, expected_number, expected_type):
        number, card_type = classify_card(raw)
        assert number == expected_number
        assert card_type == expected_type

    def test_none_raises(self):
        with pytest.raises(CardValidationError, match="required"):
            classify_card(None)

    def test_empty_string_raises(self):
        with pytest.raises(CardValidationError, match="must contain digits"):
            classify_card("")

    def test_only_letters_raises(self):
        with pytest.raises(CardValidationError, match="must contain digits"):
            classify_card("abc-def")

    @pytest.mark.parametrize("length", [11, 21])
    def test_out_of_range_length(self, length):
        with pytest.raises(CardValidationError, match="out of range"):
            classify_card("4" + "1" * (length - 1))

    @pytest.mark.parametrize("leader", ["0", "1", "2", "7", "8", "9"])
    def test_unknown_leading_digit(self, leader):
        with pytest.raises(CardValidationError, match="unrecognized card type"):
            classify_card(leader + "1234567890123")

    def test_integer_input_is_accepted(self):
        # Non-str inputs are coerced via str(); digits are extracted.
        number, card_type = classify_card(4267628872390355)
        assert number == "4267628872390355"
        assert card_type == "Visa"
