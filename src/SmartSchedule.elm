module SmartSchedule exposing (Allocation, Placement, Plan, allocationCard, allocations, cards, plan, weekDays, workdayAt)

import Card exposing (Card)
import Date exposing (Date)
import Dict
import TaskItem exposing (TaskItem)


type alias Placement =
    { task : TaskItem, start : Float, hours : Float, late : Bool }


type alias Allocation =
    { task : TaskItem, date : Date, hours : Float, late : Bool }


type alias Plan =
    { placements : List Placement, needsEstimate : List TaskItem, needsAssignee : List TaskItem }


plan : Date -> List TaskItem -> Plan
plan today tasks =
    let
        active =
            List.filter (not << TaskItem.isCompleted) tasks

        estimated =
            List.filter (TaskItem.estimateHours >> (/=) Nothing) active

        ready =
            List.filter (TaskItem.assignee >> (/=) Nothing) estimated

        groups =
            List.foldl
                (\task -> Dict.update (TaskItem.assignee task |> Maybe.withDefault "" |> String.toLower) (\group -> Just (task :: Maybe.withDefault [] group)))
                Dict.empty
                ready

        schedulePerson personTasks =
            personTasks
                |> List.sortBy priority
                |> List.foldl
                    (\task ( cursor, scheduled ) ->
                        let
                            hours =
                                TaskItem.estimateHours task |> Maybe.withDefault 0

                            finish =
                                workdayAt today (ceiling ((cursor + hours) / 8) - 1)

                            late =
                                TaskItem.due task |> Maybe.map (\due -> Date.toRataDie finish > Date.toRataDie due) |> Maybe.withDefault False
                        in
                        ( cursor + hours, { task = task, start = cursor, hours = hours, late = late } :: scheduled )
                    )
                    ( 0, [] )
                |> Tuple.second
                |> List.reverse
    in
    { placements = Dict.values groups |> List.concatMap schedulePerson
    , needsEstimate = List.filter (TaskItem.estimateHours >> (==) Nothing) active
    , needsAssignee = List.filter (TaskItem.assignee >> (==) Nothing) estimated
    }


priority task =
    ( if TaskItem.isUrgent task then
        0

      else
        1
    , TaskItem.due task |> Maybe.map Date.toRataDie |> Maybe.withDefault 2147483647
    , ( TaskItem.estimateHours task |> Maybe.withDefault 0, String.toLower (TaskItem.title task), TaskItem.id task )
    )


workdayAt : Date -> Int -> Date
workdayAt today index =
    let
        start =
            nextWorkday today

        weekday =
            Date.weekdayToNumber (Date.weekday start) - 1
    in
    Date.add Date.Days (index + 2 * ((weekday + index) // 5)) start


nextWorkday : Date -> Date
nextWorkday date =
    case Date.weekdayToNumber (Date.weekday date) of
        6 ->
            Date.add Date.Days 2 date

        7 ->
            Date.add Date.Days 1 date

        _ ->
            date


weekDays : Date -> Int -> List Date
weekDays today offset =
    let
        monday =
            Date.add Date.Days (1 - Date.weekdayToNumber (Date.weekday today) + 7 * offset) today
    in
    List.range 0 4 |> List.map (\index -> Date.add Date.Days index monday)


allocations : Date -> Int -> Plan -> List Allocation
allocations today offset schedule =
    let
        start =
            nextWorkday today

        monday =
            Date.add Date.Days (1 - Date.weekdayToNumber (Date.weekday start)) start

        dayIndex day =
            (Date.diff Date.Days monday day // 7)
                * 5
                + Date.weekdayToNumber (Date.weekday day)
                - Date.weekdayToNumber (Date.weekday start)

        onDay day placement =
            let
                index =
                    dayIndex day

                from =
                    max placement.start (toFloat index * 8)

                to =
                    min (placement.start + placement.hours) (toFloat (index + 1) * 8)
            in
            if index >= 0 && to - from > 0.000001 then
                Just { task = placement.task, date = day, hours = to - from, late = placement.late }

            else
                Nothing
    in
    weekDays today offset
        |> List.concatMap (\day -> List.filterMap (onDay day) schedule.placements)
        |> List.sortBy (\allocation -> ( Date.toRataDie allocation.date, priority allocation.task ))


allocationCard : String -> Allocation -> Card
allocationCard boardId allocation =
    Card.fromTaskItem (boardId ++ ":schedule:" ++ Date.toIsoString allocation.date) [] allocation.task


cards : String -> Date -> Int -> Plan -> List Card
cards boardId today offset schedule =
    List.map (allocationCard boardId) (allocations today offset schedule)
        ++ List.map (Card.fromTaskItem (boardId ++ ":needs-estimate") []) schedule.needsEstimate
        ++ List.map (Card.fromTaskItem (boardId ++ ":needs-assignee") []) schedule.needsAssignee
