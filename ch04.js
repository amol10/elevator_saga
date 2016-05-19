{
    init: function(elevators, floors) {
        var waiting_floors = [];
        var top_floor = floors.length - 1;

        for (i=0; i < elevators.length; i++) {
            elevator = elevators[i];
            elevator.idle = true;
            elevator.upQueue = [];
            elevator.downQueue = [];
            elevator.num = i;

            // Whenever the elevator is idle (has no more queued destinations) ...
            elevator.on("idle", function() {
                // let's go to all the floors (or did we forget one?)
                this.idle = true;
                console.log("on idle");
                handle_call("", -1);
            });

            elevator.on("floor_button_pressed", function(floorNum) {
                // Maybe tell the elevator to go to that floor?
                go_to_floor(this, floorNum);
            });
            
            elevator.on("stopped_at_floor", function(floorNum) {
                delete_if_in_array(floorNum, this.upQueue);
                delete_if_in_array(floorNum, this.downQueue);
                
                switch_dest_queue(this);
                //console.log("elv: ", this.num, "stop, up: ", JSON.stringify(this.upQueue), " down: ", JSON.stringify(this.downQueue));
            });

            elevator.on("passing_floor", function(floorNum, direction) {
                // Maybe tell the elevator to go to that floor?
                if (waiting_floors.length > 0 && available_capacity(this) > 1) {
                    var fl_index = waiting_floors.indexOf(floorNum);
                    if (fl_index > -1) {
                        waiting_floors.splice(fl_index, 1);
                        this.goToFloor(floorNum, true);
                    }
                }
            });
        }

        for (i=0; i < floors.length; i++) {
            fl = floors[i];
            fl.on("up_button_pressed", function() {
                handle_call("up", this.floorNum());
            });

            fl.on("down_button_pressed", function() {
                handle_call("down", this.floorNum());
            });
        }
        
        function available_capacity(elevator) {
            return Math.floor((1 - elevator.loadFactor()) * elevator.maxPassengerCount());
        }
        
        function go_to_floor(elevator, floorNum) {
            var dir = elevator.destinationDirection();
            var queue;
            console.log("up q: ", JSON.stringify(elevator.upQueue), " down q: ", JSON.stringify(elevator.downQueue));
            
            if (floorNum > elevator.currentFloor()) {
                queue = elevator.upQueue;
            } else {
                queue = elevator.downQueue;
            }
            if (!add_if_not_in_array(floorNum, queue)) {
                return;
            }
            
            if (dir == "stopped") {
                dir = elevator.upQueue.length >= elevator.downQueue.length ? "up" : "down";
            }
            
            if (dir == "up") {
                queue = elevator.upQueue;
                queue.sort();
            } else if (dir == "down") {
                queue = elevator.downQueue;
                queue.sort(function(a, b){return b - a});
            } else {
                console.log("should not reach here");
            }
            
            set_dest_queue(elevator, queue);
        }
        
        function set_dest_queue(elevator, queue) {
            elevator.destinationQueue = queue;
            elevator.checkDestinationQueue();
        }
        
        function switch_dest_queue(elevator) {
            if (elevator.upQueue.length == 0 && elevator.downQueue.length > 0) {
                set_dest_queue(elevator, elevator.downQueue);
            }
            if (elevator.downQueue.length == 0 && elevator.upQueue.length > 0) {
                set_dest_queue(elevator, elevator.upQueue);
            }
        }

        function handle_call(dir, floorNum) {
            for(i=0; i < elevators.length; i++) {
                elevator = elevators[i];

                if (elevator.idle) {
                    if (floorNum == -1) {
                        if (waiting_floors.length > 0) {
                            floorNum = waiting_floors.shift();
                        } else {
                            return;
                        }                     
                    }          
                    elevator.idle = false;
                    go_to_floor(elevator, floorNum);
                    return;
                }
            }
            waiting_floors.push(floorNum);
            console.log("waiting floor ", floorNum);
        };
        
        function delete_if_in_array(val, arr) {
            var index = arr.indexOf(val);
            if (index > -1) {
                arr.splice(index, 1);
            }
        }
        
        function add_if_not_in_array(val, arr) {
            var index = arr.indexOf(val);
            if (index < 0) {
                arr.push(val);
                return true;
            }
            return false;
        }
    },

        update: function(dt, elevators, floors) {
            // We normally don't need to do anything here
        }
}