var models = require('../index');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var current_time = Date.now();
var event_id = models.timeuuid();
var client;

describe('Unit Tests', function(){
    describe('#modelsync',function(done){
        it('should connect and sync with db without errors', function(done) {
            this.timeout(5000);
            this.slow(1000);
            models.setDirectory( __dirname + '/models').bind(
            {
                clientOptions: {
                    contactPoints: ['127.0.0.1'],
                    keyspace: 'express_cassandra_tests_kspc1',
                    queryOptions: {consistency: models.consistencies.one}
                },
                ormOptions: {
                    defaultReplicationStrategy : {
                        class: 'SimpleStrategy',
                        replication_factor: 1
                    },
                    dropTableOnSchemaChange: true,
                    createKeyspace: true
                }
            },
            function(err) {
                if(err) throw err;
                else done();
            }
            );
        });
    });

    describe('#multiple connections', function (done) {
        it('should create a new cassandra client', function (done) {
            this.timeout(5000);
            this.slow(1000);
            client = models.createClient({
                clientOptions: {
                    contactPoints: ['127.0.0.1'],
                    keyspace: 'express_cassandra_tests_kspc1',
                    queryOptions: {consistency: models.consistencies.one}
                },
                ormOptions: {
                    defaultReplicationStrategy : {
                        class: 'SimpleStrategy',
                        replication_factor: 1
                    },
                    dropTableOnSchemaChange: true,
                    createKeyspace: true
                }
            });

            client.connect(function(err) {
                if(err) throw err;
                else done();
            });
        });
    });

    describe('#arbitrarily load schemas', function (done) {
        after(function () {
            client.close();
        });
        it('should load a schema from an object', function (done) {
            var tmp = client.loadSchema('tempschema', {
                fields: {
                    name: 'text'
                },
                key: ['name']
            });
            tmp.should.equal(client.instance.tempschema);
            done();
        });
    });


    describe('#save',function(){
        it('should save data to without errors', function(done) {
            var revtimeMap = {};
            revtimeMap[current_time] = 'one';
            revtimeMap['2014-10-2 12:00'] = 'two';
            var alex = new models.instance.Person({
                userID:1234,
                Name:"Mahafuzur",
                age:-32,
                timeId: models.timeuuid(),
                info:{'hello':'world'},
                phones:['123456','234567'],
                emails:['a@b.com','c@d.com'],
                timeMap: {'one':current_time, 'two':'2014-10-2 12:00'},
                revtimeMap: revtimeMap,
                intMap: {'one':1, 'two':2, 'three':3},
                stringMap: {'one':'1', 'two':'2', 'three':'3'},
                timeList: [current_time, '2014-10-2 12:00'],
                intList: [1, 2, 3],
                stringList: ['one', 'two', 'three'],
                timeSet: [current_time],
                intSet: [1, 2, 3, 3],
                stringSet: ['one', 'two', 'three', 'three'],
                active: true
            });
            alex.save(function(err){
                if(err) {
                    err.name.should.equal('apollo.model.save.invalidvalue');
                    alex.age = 32;
                    alex.save(function(err){
                        if(err) throw err;
                        done();
                    });
                }
                else done(new Error("validation rule is not working properly"));
            });
        });
    });

    describe('#find after save',function(){
        it('should find data as model instances without errors', function(done) {
            models.instance.Person.find({userID:1234, age:32}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                people[0].Name.should.equal('Mahafuzur');
                people[0].surname.should.equal('no surname provided');
                people[0].completeName.should.equal('Mahafuzur');
                people[0].info.hello.should.equal('world');
                people[0].phones[1].should.equal('234567');
                people[0].emails[1].should.equal('c@d.com');
                people[0].active.should.equal(true);
                expect(people[0].uniId.toString().length).to.be.equal(36);
                expect(people[0].timeId.toString().length).to.be.equal(36);
                expect(people[0].createdAt).to.exist;
                // test virtual field
                people[0].ageString.should.equal('32');
                people[0].ageString = '50';
                people[0].age.should.equal(50);
                // test composite types
                people[0].timeMap.one.should.deep.equal(new Date(current_time));
                expect(people[0].revtimeMap[new Date(current_time).toString()]).to.equal('one');
                people[0].timeList[0].should.deep.equal(new Date(current_time));
                people[0].timeSet.should.have.deep.members([new Date(current_time)]);
                people[0].intMap.should.deep.equal({"one": 1, "two": 2, "three": 3});
                people[0].stringMap.should.deep.equal({"one": '1', "two": '2', "three": '3'});
                expect(people[0].intList).to.have.members([1, 2, 3]);
                expect(people[0].stringList).to.have.members(['one', 'two', 'three']);
                expect(people[0].intSet).to.have.members([1, 2, 3]);
                expect(people[0].stringSet).to.have.members(['one', 'two', 'three']);
                should.exist(people[0]._validators);
                //test composite defaults
                people[0].intMapDefault.should.deep.equal({"one": 1, "two": 2});
                expect(people[0].stringListDefault).to.have.members(['one', 'two']);
                expect(people[0].intSetDefault).to.have.members([1, 2]);
                done();
            });
        });
    });

    describe('#find with raw set to true',function(){
        it('should find raw data as saved without errors', function(done) {
            models.instance.Person.find({userID:1234, age:32}, {raw: true}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                people[0].Name.should.equal('Mahafuzur');
                people[0].info.hello.should.equal('world');
                people[0].phones[1].should.equal('234567');
                people[0].emails[1].should.equal('c@d.com');
                should.not.exist(people[0]._validators);
                done();
            });
        });
    });

    describe('#findOne after save',function(){
        it('should find a single data object without errors', function(done) {
            models.instance.Person.findOne({userID:1234, age:32}, function(err, user){
                if(err) throw err;
                user.Name.should.equal('Mahafuzur');
                user.info.hello.should.equal('world');
                user.phones[1].should.equal('234567');
                user.emails[1].should.equal('c@d.com');
                done();
            });
        });
    });

    describe('#findOne with selected columns',function(){
        it('should find a row with only selected columns', function(done) {
            models.instance.Person.findOne({userID:1234, age:32}, {select: ['Name as name','info']}, function(err, user){
                if(err) throw err;
                user.name.should.equal('Mahafuzur');
                user.info.hello.should.equal('world');
                should.not.exist(user.phones);
                should.not.exist(user.emails);
                done();
            });
        });
    });

    describe('#findOne with aggregate function',function(){
        it('should find a row with only selected columns', function(done) {
            models.instance.Person.findOne({userID:1234}, {select: ['sum(age)']}, function(err, user){
                if(err) throw err;
                user['system.sum(age)'].should.equal(32);
                done();
            });
        });
    });

    describe('#find with $gt and $lt operator',function(){
        it('should find data as saved without errors', function(done) {
            models.instance.Person.find({userID:1234, age:{'$gt':31,'$lt':35}}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                done();
            });
        });
    });

    describe('#find with $in operator',function(){
        it('should find data as saved without errors', function(done) {
            models.instance.Person.find({userID:{'$in':[1234,1235]}, age:32}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                done();
            });
        });
    });

    describe('#find with $token operator',function(){
        it('should find data as saved without errors', function(done) {
            models.instance.Person.find({userID:{'$token':{'$gt':1235,'$lte':1234}},$limit:1}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                done();
            });
        });
    });

    describe('#find with $token operator for composite key',function(){
        it('should find data as saved without errors', function(done) {
            models.instance.Person.find({'userID,age':{'$token':{'$gte':[1234,32]}}}, {materialized_view: 'mat_view_composite', raw: true}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                people[0].Name.should.equal('Mahafuzur');
                done();
            });
        });
    });

    describe('#find with raw driver',function(){
        it('should not through any errors', function(done) {
            models.instance.Person.get_cql_client(function(err, client){
                if(err) throw err;
                client.eachRow('Select * from person limit 10', [], { autoPage : true }, function(n, row) {}, function(err, result){
                    if(err) throw err;
                    done();
                });
            });
        });
    });

    describe('#update',function(){
        it('should update data on db without errors', function(done) {
            models.instance.Person.update({userID:1234, age:32}, {Name:1, info:{'new':'addition'}, phones:['56788'], emails:['c@d.com']}, function(err){
                if(err) {
                    err.name.should.equal('apollo.model.update.invalidvalue');
                    models.instance.Person.update({userID:1234, age:32}, {Name:"Stupid", timeId:models.timeuuid(), info:{'new':'addition'}, phones:['56788'], emails:['c@d.com'], active: false}, function(err){
                        if(err) throw err;
                        done();
                    });
                }
                else done(new Error("validation rule is not working properly"));
            });
        });
    });

    describe('#find after update',function(){
        it('should find data as updated without errors', function(done) {
            models.instance.Person.find({userID: 1234,age:32}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                people[0].Name.should.equal('Stupid');
                people[0].info.new.should.equal('addition');
                people[0].phones[0].should.equal('56788');
                people[0].emails[0].should.equal('c@d.com');
                people[0].emails.length.should.equal(1);
                people[0].active.should.equal(false);
                expect(people[0].timeId.toString().length).to.be.equal(36);
                done();
            });
        });
    });

    describe('#instance update after find',function(){
        it('should find and update single data object without errors', function(done) {
            models.instance.Person.findOne({userID:1234, age:32}, function(err, user){
                if(err) throw err;
                user.Name = "Updated Stupid";
                user.timeId = models.timeuuid();
                user.timeMap['three'] = current_time;
                user.save(function(err){
                    if(err) throw err;
                    models.instance.Person.findOne({userID:1234, age:32}, function(err, user_new){
                        if(err) throw err;
                        user_new.Name.should.equal('Updated Stupid');
                        user_new.timeMap.three.should.deep.equal(new Date(current_time));
                        expect(user_new.timeId.toString().length).to.be.equal(36);
                        done();
                    });
                });
            });
        });
    });

    describe('#instance delete after find',function(){
        it('should find and delete single data object without errors', function(done) {
            models.instance.Person.findOne({userID:1234, age:32}, function(err, user){
                if(err) throw err;
                user.delete(function(err){
                    if(err) throw err;
                    models.instance.Person.findOne({userID:1234, age:32}, function(err, user_new){
                        if(err) throw err;
                        expect(user_new).to.not.exist;
                        done();
                    });
                });
            });
        });
    });

    describe('#delete',function(){
        it('should cleanup the db without errors', function(done) {
            models.instance.Person.delete({userID:1234, age:32}, function(err){
                if(err) throw err;
                done();
            });
        });
    });

    describe('#find after delete',function(){
        it('should find all data as deleted', function(done) {
            models.instance.Person.find({userID: 1234}, function(err, people){
                if(err) throw err;
                people.length.should.equal(0);
                done();
            });
        });
    });

    describe('#update counter column',function(){
        it('should increment the counter to 2', function(done) {
            models.instance.Counter.update({user_id:1234}, {visit_count:2}, function(err){
                if(err) throw err;
                models.instance.Counter.findOne({user_id:1234}, function(err, stats){
                    if(err) throw err;
                    stats.visit_count.toString().should.equal('2');
                    done();
                });
            });
        });
        it('should keep the counter unchanged', function(done) {
            models.instance.Counter.update({user_id:1234}, {visit_count:0}, function(err){
                if(err) throw err;
                models.instance.Counter.findOne({user_id:1234}, function(err, stats){
                    if(err) throw err;
                    stats.visit_count.toString().should.equal('2');
                    done();
                });
            });
        });
        it('should decrement the counter to 0', function(done) {
            models.instance.Counter.update({user_id:1234}, {visit_count:-2}, function(err){
                if(err) throw err;
                models.instance.Counter.findOne({user_id:1234}, function(err, stats){
                    if(err) throw err;
                    stats.visit_count.toString().should.equal('0');
                    done();
                });
            });
        });
        it('should increment the counter visitCount to 2', function(done) {
            models.instance.Counter.update({user_id:1234}, {visitCount:2}, function(err){
                if(err) throw err;
                models.instance.Counter.findOne({user_id:1234}, function(err, stats){
                    if(err) throw err;
                    stats.visitCount.toString().should.equal('2');
                    done();
                });
            });
        });
        it('should decrement the counter visitCount to 0', function(done) {
            models.instance.Counter.update({user_id:1234}, {visitCount:-2}, function(err){
                if(err) throw err;
                models.instance.Counter.findOne({user_id:1234}, function(err, stats){
                    if(err) throw err;
                    stats.visitCount.toString().should.equal('0');
                    done();
                });
            });
        });
    });

    describe('#raw batch queries',function(){
        it('should insert data properly', function(done) {
            var queries = [
                {
                    query: "INSERT INTO event (email, id, body, extra) VALUES (?, ?, ?, ?)",
                    params: ['hello1@h.com', event_id, 'hello1', 'extra1']
                },
                {
                    query: "INSERT INTO event (email, id, body, extra) VALUES (?, ?, ?, ?)",
                    params: ['hello2@h.com', event_id, 'hello2', 'extra2']
                }
            ];

            models.instance.Event.get_cql_client(function(err, client){
                client.batch(queries, { prepare: true }, function(err) {
                    if(err){
                        throw err;
                    }
                    done();
                });
            });
        });
    });

    describe('#find after raw batch events',function(){
        it('should find the event with email and timeuuid in query', function(done) {
            models.instance.Event.findOne({email: 'hello1@h.com', id: event_id}, function(err, event){
                if(err) throw err;
                models.instance.Event.findOne({email: 'hello1@h.com', id: event.id}, function(err, event){
                    if(err) throw err;
                    event.body.should.equal('hello1');
                    done();
                });
            });
        });
    });

    describe('#verify if all inserted events went to the materialized view',function(){
        it('should find all the events filtered by id from materialized view', function(done) {
            models.instance.Event.find({id: event_id}, {materialized_view: 'event_by_id'}, function(err, events){
                if(err) throw err;
                events.length.should.equal(2);
                done();
            });
        });
    });

    describe('#testing instance update for an event object taken from materialized view',function(){
        it('should get an event by id and email from materialized view and instance update it', function(done) {
            models.instance.Event.findOne({id: event_id, email: 'hello1@h.com'}, {materialized_view: 'event_by_id'}, function(err, event){
                if(err) throw err;
                event.body = 'hello1 updated';
                event.save(function(err){
                    models.instance.Event.findOne({id: event_id, email: 'hello1@h.com'}, function(err, event_updated){
                        if(err) throw err;
                        event_updated.body.should.equal('hello1 updated');
                        event_updated.extra.should.equal('extra1'); //check if the extra section that is not part of the materialized view is kept intact by the save operation

                        //check also if the materialized view has updated
                        models.instance.Event.findOne({id: event_id, email: 'hello1@h.com'}, {materialized_view: 'event_by_id'}, function(err, event_updated){
                            if(err) throw err;
                            event_updated.body.should.equal('hello1 updated');
                            done();
                        });
                    });
                })
            });
        });
    });

    describe('#orm batch queries',function(){
        it('should save, update and delete data properly', function(done) {
            var queries = [];

            var event = new models.instance.Event({
                email: 'hello3@h.com',
                id: event_id,
                body: 'hello3'
            });

            queries.push(event.save({return_query: true}));
            queries.push(models.instance.Event.update({email: 'hello1@h.com', id: event_id}, {body:'hello1 updated again'}, {return_query: true}));
            queries.push(models.instance.Event.delete({email: 'hello2@h.com', id: event_id}, {return_query: true}));

            models.doBatch(queries, function(err){
                if(err) throw err;
                done();
            });
        });
    });

    describe('#find with distinct set to true',function(){
        it('should find distinct data as saved without errors', function(done) {
            models.instance.Event.find({}, {select: ['email'], distinct: true}, function(err, event){
                if(err) throw err;
                event.length.should.equal(2);
                done();
            });
        });
    });

    describe('#verify orm batch modifications on table and materialized view',function(){
        it('should find modifications reflected in events', function(done) {
            models.instance.Event.find({'$limit':10}, function(err, events){
                if(err) throw err;
                events.length.should.equal(2);
                events[0].body.should.equal('hello1 updated again');
                events[1].body.should.equal('hello3');

                done();
            });
        });

        it('should find modifications reflected in materialized view', function(done) {
            models.instance.Event.find({id: event_id, $orderby:{'$asc' :'email'}}, {materialized_view: 'event_by_id', raw: true}, function(err, events){
                if(err) throw err;
                events.length.should.equal(2);
                events[0].body.should.equal('hello1 updated again');
                events[1].body.should.equal('hello3');

                done();
            });
        });
    });

    describe('#find all remaining events and delete using orm batch',function(){
        it('should find remaining events and delete them', function(done) {
            models.instance.Event.find({'$limit':10}, function(err, events){
                if(err) throw err;

                var queries = [];

                for(var i=0;i<events.length;i++) {
                    queries.push(events[i].delete({return_query: true}));
                }

                models.doBatch(queries, function(err){
                    if(err) throw err;
                    done();
                });
            });
        });
    });

    describe('#verify all events are deleted',function(){
        it('should find all the events deleted from table', function(done) {
            models.instance.Event.find({'$limit':10}, function(err, events){
                if(err) throw err;
                events.length.should.equal(0);
                done();
            });
        });
    });

    describe('#verify events are deleted from materialized view',function(){
        it('should find all the events deleted from materialized view', function(done) {
            models.instance.Event.find({id: event_id}, {materialized_view: 'event_by_id'}, function(err, events){
                if(err) throw err;
                events.length.should.equal(0);
                done();
            });
        });
    });

    describe('#close cassandra connection',function(){
        it('should close connection to cassandra without errors', function(done) {
            models.close(function(err){
                if(err) throw err;
                done();
            });
        });
    });
});
