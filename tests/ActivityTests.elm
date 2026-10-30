module ActivityTests exposing (suite)

import Activity
import DataviewTaskCompletion
import Date
import Expect
import Parser
import TagList
import TaskItem
import Test exposing (describe, test)
import Time


parse text =
    Parser.run (TaskItem.parserWithYear (Just 2026) (DataviewTaskCompletion.Text "completion") "Tasks.md" Nothing TagList.empty 1) text |> Result.withDefault TaskItem.dummy


suite =
    describe "Vault activity, assignment and takes durations"
        [ test "a person named Unassigned remains separate from cards with no assignee" <|
            \() ->
                Activity.rows Nothing [ parse "- [x] Named @assigned(Unassigned) @takes(2h)", parse "- [x] No person" ]
                    |> Expect.equal [ { person = "Unassigned", tasks = 1, hours = 2 }, { person = "Unassigned tasks", tasks = 1, hours = 1 } ]
        , test "spent is separate from estimated duration and hidden from the title" <|
            \() ->
                parse "- [x] Work @assigned(Killian) @takes(4h) @spent(3h)" |> (\task -> ( TaskItem.title task, TaskItem.estimateHours task, TaskItem.actualHours task )) |> Expect.equal ( "Work", Just 4, Just 3 )
        , test "cumulative comparison splits shared estimates but keeps Killian actual hours intact" <|
            \() ->
                [ parse "- [x] Shared @assigned(Killian) @assigned(Sam) @takes(4h) @spent(3h) ✅ 2026-10-29", parse "- [x] Solo @assigned(Killian) @takes(1h) @spent(2h) ✅ 2026-10-30" ]
                    |> Activity.feedbackPoints Time.utc
                    |> List.map (\point -> ( Date.toIsoString point.date, point.estimated, point.actual ))
                    |> Expect.equal [ ( "2026-10-29", 2, 3 ), ( "2026-10-30", 3, 5 ) ]
        , test "comparison excludes unrecorded actuals and counts missing estimates as one hour" <|
            \() ->
                [ parse "- [x] Done @assigned(Killian) @spent(2h) ✅ 2026-10-30", parse "- [x] Historical @assigned(Killian) @takes(9h) ✅ 2026-10-29" ]
                    |> Activity.feedbackPoints Time.utc
                    |> List.map (\point -> ( point.estimated, point.actual ))
                    |> Expect.equal [ ( 1, 2 ) ]
        , test "shared completed hours split equally and each person counts the task" <|
            \() ->
                Activity.rows Nothing [ parse "- [x] Shared @takes(4h) @assigned(Alex) @assigned(Sam)" ]
                    |> Expect.equal [ { person = "Alex", tasks = 1, hours = 2 }, { person = "Sam", tasks = 1, hours = 2 } ]
        , test "missing duration defaults to one hour; incomplete tasks are excluded" <|
            \() ->
                Activity.rows Nothing [ parse "- [x] Done @assigned(Alex)", parse "- [ ] Pending @takes(10h) @assigned(Alex)" ]
                    |> Expect.equal [ { person = "Alex", tasks = 1, hours = 1 } ]
        , test "editing a duration recomputes totals and person filters include shared tasks" <|
            \() ->
                Activity.rows (Just "sam") [ parse "- [x] Shared @takes(6h) @assigned(Alex) @assigned(Sam)", parse "- [x] Other @takes(8h) @assigned(Alex)" ]
                    |> Expect.equal [ { person = "Sam", tasks = 1, hours = 3 } ]
        , test "working days are eight hours and duration tags are hidden from titles" <|
            \() ->
                parse "- [ ] Work @takes(0.5d)" |> (\task -> ( TaskItem.title task, TaskItem.estimateHours task )) |> Expect.equal ( "Work", Just 4 )
        , test "assignment order is stable, case-insensitively unique and limited to four" <|
            \() ->
                parse "- [ ] Work @assigned(Alex) @assigned(alex) @assigned(Sam) @assigned(Jo) @assigned(Riley) @assigned(Dana)" |> TaskItem.assignees |> Expect.equal [ "Alex", "Sam", "Jo", "Riley" ]
        , test "plain completions have no fabricated activity date" <|
            \() ->
                parse "- [x] Done" |> Activity.day Time.utc |> Expect.equal Nothing
        , test "date-only completion stays on its calendar date west of UTC" <|
            \() ->
                parse "- [x] Done ✅ 2026-10-30" |> Activity.day (Time.customZone -480 []) |> Maybe.map Date.toIsoString |> Expect.equal (Just "2026-10-30")
        ]
