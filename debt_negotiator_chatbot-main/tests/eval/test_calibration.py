"""Judge calibration arithmetic (CLAUDE.md §8).

§8 requires validating the judge against human ratings before trusting it. No
human ratings exist, so the important property is that the harness stays honest
about that — an uncalibrated judge must never present as a calibrated one.
"""

from __future__ import annotations

from eval.calibrate.store import MIN_RATINGS, spearman


def test_perfect_agreement_correlates_at_one() -> None:
    xs = [1.0, 3.0, 5.0, 7.0, 9.0]
    assert spearman(xs, xs) == 1.0


def test_reversed_ranking_correlates_at_minus_one() -> None:
    assert spearman([1.0, 2.0, 3.0, 4.0], [4.0, 3.0, 2.0, 1.0]) == -1.0


def test_a_consistent_offset_still_correlates_perfectly() -> None:
    """Spearman rather than Pearson on purpose: a judge sitting two points high
    but ranking correctly is useful. Ordering is the question, not calibration
    of the absolute number."""
    human = [2.0, 4.0, 6.0, 8.0]
    judge = [4.0, 6.0, 8.0, 10.0]
    assert spearman(human, judge) == 1.0


def test_ties_do_not_break_the_correlation() -> None:
    """A judge that scores everything 7 is a real failure mode. It must produce
    'no signal', not a crash and not a spurious correlation."""
    assert spearman([1.0, 2.0, 3.0], [7.0, 7.0, 7.0]) is None


def test_too_few_points_is_not_a_correlation() -> None:
    assert spearman([1.0], [1.0]) is None
    assert spearman([], []) is None


def test_mismatched_lengths_return_none() -> None:
    assert spearman([1.0, 2.0], [1.0]) is None


def test_thirty_ratings_are_required_before_trusting_the_judge() -> None:
    """The threshold is not arbitrary-but-hidden — it is asserted, so lowering
    it is a visible decision rather than a quiet one."""
    assert MIN_RATINGS == 30


def test_judge_is_uncalibrated_with_no_human_ratings() -> None:
    """The state this project is actually in, and must report honestly."""
    from eval.calibrate import store

    calibrated, count = store.calibration_status()
    if count < MIN_RATINGS:
        assert calibrated is False
