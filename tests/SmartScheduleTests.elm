module SmartScheduleTests exposing (suite)

import DataviewTaskCompletion
import Date exposing (Date)
import Expect
import Parser
import SmartSchedule
import TagList
import TaskItem exposing (TaskItem)
import Test exposing (Test, describe, test)


suite : Test
suite =
    describe "smart scheduling"
        [ test "a ten-hour task splits across two workdays" <|
            \() ->
                schedule [ task "Long @estimate(10h) @assigned(Alex)" ]
                    |> SmartSchedule.allocations today 0
                    |> List.map (\allocation -> ( Date.toIsoString allocation.date, allocation.hours ))
                    |> Expect.equal [ ( "2026-10-28", 8 ), ( "2026-10-29", 2 ) ]
        , test "each person has an independent eight-hour daily capacity" <|
            \() ->
                schedule [ task "A @estimate(8h) @assigned(Alex)", task "B @estimate(8h) @assigned(Sam)" ]
                    |> SmartSchedule.allocations today 0
                    |> List.map (\allocation -> ( Date.toIsoString allocation.date, allocation.hours ))
                    |> Expect.equal [ ( "2026-10-28", 8 ), ( "2026-10-28", 8 ) ]
        , test "urgent tasks precede non-urgent tasks even with an earlier deadline" <|
            \() ->
                schedule [ task "Normal @estimate(1h) @assigned(Alex) due 28-10", task "Urgent @urgent @estimate(8h) @assigned(Alex) due 30-10" ]
                    |> .placements
                    |> List.map (.task >> TaskItem.title)
                    |> Expect.equal [ "Urgent", "Normal" ]
        , test "deadline outranks duration within the same urgency group" <|
            \() ->
                schedule [ task "Short @estimate(1h) @assigned(Alex) due 30-10", task "Earlier @estimate(8h) @assigned(Alex) due 29-10" ]
                    |> .placements
                    |> List.map (.task >> TaskItem.title)
                    |> Expect.equal [ "Earlier", "Short" ]
        , test "short tasks precede long tasks with the same deadline" <|
            \() ->
                schedule [ task "Long @estimate(8h) @assigned(Alex) due 30-10", task "Short @estimate(1h) @assigned(Alex) due 30-10" ]
                    |> .placements
                    |> List.map (.task >> TaskItem.title)
                    |> Expect.equal [ "Short", "Long" ]
        , test "undated tasks follow dated tasks within an urgency group" <|
            \() ->
                schedule [ task "Undated @estimate(1h) @assigned(Alex)", task "Dated @estimate(8h) @assigned(Alex) due 30-10" ]
                    |> .placements
                    |> List.map (.task >> TaskItem.title)
                    |> Expect.equal [ "Dated", "Undated" ]
        , test "all allocations of a task that finishes late are highlighted" <|
            \() ->
                schedule [ task "Late @estimate(10h) @assigned(Alex) due 28-10" ]
                    |> SmartSchedule.allocations today 0
                    |> List.map .late
                    |> Expect.equal [ True, True ]
        , test "a task finishing on its deadline is on time" <|
            \() ->
                schedule [ task "On time @estimate(8h) @assigned(Alex) due 28-10" ]
                    |> .placements
                    |> List.map .late
                    |> Expect.equal [ False ]
        , test "estimates are required and unassigned work is kept out of capacity" <|
            \() ->
                let
                    result =
                        schedule [ task "Unknown @assigned(Alex)", task "Unassigned @estimate(3h)" ]
                in
                ( List.length result.placements, List.length result.needsEstimate, List.length result.needsAssignee )
                    |> Expect.equal ( 0, 1, 1 )
        , test "completed tasks are excluded" <|
            \() ->
                Parser.run (TaskItem.parserWithYear (Just 2026) DataviewTaskCompletion.NoCompletion "done.md" Nothing TagList.empty 0)
                    "- [x] Done @estimate(8h) @assigned(Alex)"
                    |> Result.withDefault TaskItem.dummy
                    |> List.singleton
                    |> schedule
                    |> .placements
                    |> Expect.equal []
        , test "weekends do not consume working time" <|
            \() ->
                SmartSchedule.workdayAt (date "2026-10-30") 1
                    |> Date.toIsoString
                    |> Expect.equal "2026-11-02"
        , test "starting on Saturday schedules from Monday" <|
            \() ->
                SmartSchedule.workdayAt (date "2026-10-31") 0
                    |> Date.toIsoString
                    |> Expect.equal "2026-11-02"
        , test "overflow continues into subsequent weeks without rescheduling from scratch" <|
            \() ->
                schedule [ task "Large @estimate(4d) @assigned(Alex)" ]
                    |> SmartSchedule.allocations today 1
                    |> List.map (\allocation -> ( Date.toIsoString allocation.date, allocation.hours ))
                    |> Expect.equal [ ( "2026-11-02", 8 ) ]
        , test "day estimates convert to eight-hour working days" <|
            \() ->
                task "Fraction @estimate(0.5d) @assigned(Alex)"
                    |> TaskItem.estimateHours
                    |> Expect.equal (Just 4)
        , test "the view contains exactly Monday through Friday" <|
            \() ->
                SmartSchedule.weekDays today 0
                    |> List.map Date.toIsoString
                    |> Expect.equal [ "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30" ]
        , test "the combined day view also puts urgent work first across people" <|
            \() ->
                schedule [ task "Normal @estimate(1h) @assigned(Alex)", task "Urgent @urgent @estimate(2h) @assigned(Sam)" ]
                    |> SmartSchedule.allocations today 0
                    |> List.map (.task >> TaskItem.title)
                    |> Expect.equal [ "Urgent", "Normal" ]
        , test "elapsed days of the current week receive no allocations" <|
            \() ->
                schedule [ task "Work @estimate(2h) @assigned(Alex)" ]
                    |> SmartSchedule.allocations today 0
                    |> List.all (\allocation -> Date.toRataDie allocation.date >= Date.toRataDie today)
                    |> Expect.equal True
        ]


today : Date
today =
    date "2026-10-28"


date : String -> Date
date text =
    Date.fromIsoString text |> Result.withDefault (Date.fromRataDie 1)


task : String -> TaskItem
task text =
    Parser.run (TaskItem.parserWithYear (Just 2026) DataviewTaskCompletion.NoCompletion (text ++ ".md") Nothing TagList.empty 0) ("- [ ] " ++ text)
        |> Result.withDefault TaskItem.dummy


schedule : List TaskItem -> SmartSchedule.Plan
schedule =
    SmartSchedule.plan today
