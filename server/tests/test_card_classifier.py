import pytest

from app.services.card_classifier import CardValidationError, classify_card


class TestClassifyCard:
    @pytest.mark.parametrize(
        "raw, expected_number, expected_type",
        [
            ("4267628872390354", "4267628872390354", "Visa"),
            ("5553959204036898", "5553959204036898", "MasterCard"),
            ("6714744990978279", "6714744990978279", "Discover"),
            ("3336208249795483", "3336208249795483", "Amex"),
            # Non-digits get stripped.
            ("4267-6288-7239-0354", "4267628872390354", "Visa"),
            ("  5553 9592 0403 6898  ", "5553959204036898", "MasterCard"),
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
        number, card_type = classify_card(4267628872390354)
        assert number == "4267628872390354"
        assert card_type == "Visa"

    def test_luhn_check_rejects_transposed_digits(self):
        # Valid Luhn baseline accepted.
        classify_card("4267628872390354")
        # Swap the last two digits → Luhn fails.
        with pytest.raises(CardValidationError, match="Luhn"):
            classify_card("4267628872390345")
