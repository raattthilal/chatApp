module.exports = function TargetMapping(sequelize) {
    var Sequelize = sequelize.constructor;
    var lsgi_type = require('./lsgiType.model')(sequelize);
    var ret =
        sequelize.define('targetMapping', {

            id:{
                type: Sequelize.INTEGER,
                autoIncrement:true,
                allowNull:false,
                primaryKey:true
            },
            question_id	: {
                type: Sequelize.INTEGER,
                allowNull:false
            },
            //question lsgi
            question: {
                type: Sequelize.STRING,
                allowNull:false,
            },
            lsgi_type_id: {
                type: Sequelize.INTEGER,
                allowNull:false,
            },
            //lsgi_type
            // lsgi_type: {
            //     type: Sequelize.STRING,
            //     allowNull:false,
            // },
            //target for lsgi_type
            target: {
                type: Sequelize.INTEGER,
                allowNull:false,
            },
            status: {
                type: Sequelize.STRING,
                allowNull:false,
            },
            created_at: {
                type: 'TIMESTAMP',
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                allowNull: false
            },
            modified_at: {
                type: 'TIMESTAMP',
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                allowNull: false
            },

        }, {
            tableName: 'target_mapping',
            timestamps: false

        });

    ret.belongsTo(lsgi_type, { foreignKey: 'lsgi_type_id' });


    return ret;
}
